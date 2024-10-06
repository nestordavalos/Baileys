import { Boom } from '@hapi/boom'
import { proto } from '../../WAProto'
import { BinaryNode } from './types'

// Utility functions to handle BinaryNode structures

export const getBinaryNodeChildren = (node: BinaryNode | undefined, childTag: string) => {
    if (!node || !Array.isArray(node.content)) {
        return []
    }
    return node.content.filter(item => item.tag === childTag)
}

export const getAllBinaryNodeChildren = ({ content }: BinaryNode) => {
    return Array.isArray(content) ? content : []
}

export const getBinaryNodeChild = (node: BinaryNode | undefined, childTag: string) => {
    if (!node || !Array.isArray(node.content)) {
        return undefined
    }
    return node.content.find(item => item.tag === childTag)
}

export const getBinaryNodeChildBuffer = (node: BinaryNode | undefined, childTag: string) => {
    const child = getBinaryNodeChild(node, childTag)?.content
    return (Buffer.isBuffer(child) || child instanceof Uint8Array) ? child : undefined
}

export const getBinaryNodeChildString = (node: BinaryNode | undefined, childTag: string) => {
    const child = getBinaryNodeChild(node, childTag)?.content
    if (Buffer.isBuffer(child) || child instanceof Uint8Array) {
        return Buffer.from(child).toString('utf-8')
    } else if (typeof child === 'string') {
        return child
    }
    return undefined
}

export const getBinaryNodeChildUInt = (node: BinaryNode, childTag: string, length: number) => {
    const buff = getBinaryNodeChildBuffer(node, childTag)
    return buff ? bufferToUInt(buff, length) : undefined
}

export const assertNodeErrorFree = (node: BinaryNode) => {
    const errNode = getBinaryNodeChild(node, 'error')
    if (errNode) {
        const errorMessage = errNode.attrs.text || 'Unknown error'
        const errorCode = +errNode.attrs.code || 500
        throw new Boom(errorMessage, { data: errorCode })
    }
}

export const reduceBinaryNodeToDictionary = (node: BinaryNode, tag: string) => {
    const nodes = getBinaryNodeChildren(node, tag)
    return nodes.reduce((dict, { attrs }) => {
        dict[attrs.name || attrs.config_code] = attrs.value || attrs.config_value
        return dict
    }, {} as { [_: string]: string })
}

export const getBinaryNodeMessages = ({ content }: BinaryNode) => {
    if (!Array.isArray(content)) {
        return []
    }
    return content
        .filter(item => item.tag === 'message')
        .map(item => proto.WebMessageInfo.decode(item.content as Buffer))
}

function bufferToUInt(e: Uint8Array | Buffer, t: number) {
    return e.slice(0, t).reduce((a, byte) => (256 * a) + byte, 0)
}

const tabs = (n: number) => '  '.repeat(n)

export function binaryNodeToString(node: BinaryNode | BinaryNode['content'], i = 0): string {
    if (!node) {
        return ''
    }

    if (typeof node === 'string') {
        return tabs(i) + node
    }

    if (node instanceof Uint8Array) {
        return tabs(i) + Buffer.from(node).toString('hex')
    }

    if (Array.isArray(node)) {
        return node.map((x) => binaryNodeToString(x, i + 1)).join('\n')
    }

    const children = binaryNodeToString(node.content, i + 1)
    const attrsString = Object.entries(node.attrs || {})
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}='${v}'`)
        .join(' ')

    const tag = `<${node.tag}${attrsString ? ' ' + attrsString : ''}`
    const content = children ? `>\n${children}\n${tabs(i)}</${node.tag}>` : '/>'

    return tag + content
}