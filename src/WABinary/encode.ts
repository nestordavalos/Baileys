import * as constants from './constants'
import { FullJid, jidDecode } from './jid-utils'
import type { BinaryNode, BinaryNodeCodingOptions } from './types'

export const encodeBinaryNode = (
    node: BinaryNode,
    opts: Pick<BinaryNodeCodingOptions, 'TAGS' | 'TOKEN_MAP'> = constants,
    buffer: number[] = [0]
): Buffer => {
    const encoded = encodeBinaryNodeInner(node, opts, buffer)
    return Buffer.from(encoded)
}

const encodeBinaryNodeInner = (
    { tag, attrs, content }: BinaryNode,
    opts: Pick<BinaryNodeCodingOptions, 'TAGS' | 'TOKEN_MAP'>,
    buffer: number[]
): number[] => {
    const { TAGS, TOKEN_MAP } = opts

    const pushByte = (value: number) => buffer.push(value & 0xff)

    const pushInt = (value: number, n: number, littleEndian = false) => {
        for(let i = 0; i < n; i++) {
            const curShift = littleEndian ? i : n - 1 - i
            buffer.push((value >> (curShift * 8)) & 0xff)
        }
    }

    const pushBytes = (bytes: Uint8Array | Buffer | number[]) => {
        for(const b of bytes) {
            buffer.push(b)
        }
    }

    const writeByteLength = (length: number) => {
        if(length >= 4294967296) {
            throw new Error('String too large to encode: ' + length)
        }

        if(length >= 1 << 20) {
            pushByte(TAGS.BINARY_32)
            pushInt(length, 4)
        } else if(length >= 256) {
            pushByte(TAGS.BINARY_20)
            pushInt(length, 3)
        } else {
            pushByte(TAGS.BINARY_8)
            pushByte(length)
        }
    }

    const writeStringRaw = (str: string) => {
        const bytes = Buffer.from(str, 'utf-8')
        writeByteLength(bytes.length)
        pushBytes(bytes)
    }

	const writeJid = ({ domainType, device, user, server }: FullJid) => {
		if (!user || user.trim() === '') {
			console.error("❌ JID inválido detectado. Saltando procesamiento.", { user, server });
			return; // Evita procesar JIDs inválidos
		}
	
		if(typeof device !== 'undefined') {
			pushByte(TAGS.AD_JID)
			pushByte(domainType || 0)
			pushByte(device || 0)
			writeString(user)
		} else {
			pushByte(TAGS.JID_PAIR)
			writeString(user)
			writeString(server)
		}
	}
	

    const writeString = (str: string) => {
        if (typeof str !== 'string') {
            console.error("❌ Error: String inválido:", str)
            return
        }

        const tokenIndex = TOKEN_MAP[str]
        if(tokenIndex) {
            if(typeof tokenIndex.dict === 'number') {
                pushByte(TAGS.DICTIONARY_0 + tokenIndex.dict)
            }
            pushByte(tokenIndex.index)
        } else if(str) {
            if (str.includes('@')) {
                const decodedJid = jidDecode(str)
                if(decodedJid) {
                    writeJid(decodedJid)
                } else {
                    console.warn(`⚠️ Advertencia: No se pudo decodificar el JID: ${str}`)
                    writeStringRaw(str)
                }
            } else {
                writeStringRaw(str)
            }
        }
    }

    const writeListStart = (listSize: number) => {
        if(listSize === 0) {
            pushByte(TAGS.LIST_EMPTY)
        } else if(listSize < 256) {
            pushBytes([TAGS.LIST_8, listSize])
        } else {
            pushByte(TAGS.LIST_16)
            pushInt(listSize, 2)
        }
    }

    const validAttributes = Object.keys(attrs).filter(k => (
        typeof attrs[k] !== 'undefined' && attrs[k] !== null
    ))

    writeListStart(2 * validAttributes.length + 1 + (typeof content !== 'undefined' ? 1 : 0))
    writeString(tag)

    for(const key of validAttributes) {
        if(typeof attrs[key] === 'string') {
            writeString(key)
            writeString(attrs[key])
        }
    }

    if(typeof content === 'string') {
        writeString(content)
    } else if(Buffer.isBuffer(content) || content instanceof Uint8Array) {
        writeByteLength(content.length)
        pushBytes(content)
    } else if(Array.isArray(content)) {
        writeListStart(content.length)
        for(const item of content) {
            encodeBinaryNodeInner(item, opts, buffer)
        }
    } else if(typeof content === 'undefined') {
        // do nothing
    } else {
        throw new Error(`❌ Error: Tipo de contenido inválido en "${tag}": ${content} (${typeof content})`)
    }

    return buffer
}
