import { jest } from '@jest/globals'
import { decryptMessageNode } from '../../Utils/decode-wa-message'
import type { SignalRepository } from '../../Types'
import type { ILogger } from '../../Utils/logger'

const createLogger = (): ILogger => {
        const logger: ILogger = {
                level: 'info',
                child: () => logger,
                trace: jest.fn(),
                debug: jest.fn(),
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn()
        }
        return logger
}

const createRepository = (lid: string | null) => {
        const lidMapping = { getLIDForPN: jest.fn(async () => lid) }
        const repository: SignalRepository = {
                decryptMessage: jest.fn(async () => new Uint8Array([1])),
                decryptGroupMessage: jest.fn(),
                processSenderKeyDistributionMessage: jest.fn(),
                getLIDMappingStore: () => lidMapping,
                storeLIDPNMapping: jest.fn()
        } as unknown as SignalRepository
        return { repository, lidMapping }
}

describe('getDecryptionJid', () => {
        const pnJid = '1234567890@s.whatsapp.net'
        const stanza = {
                tag: 'message',
                attrs: { id: 'msg-1', from: pnJid, t: '0' },
                content: [
                        { tag: 'enc', attrs: { type: 'msg' }, content: new Uint8Array() }
                ]
        }

        it('falls back to PN session when LID mapping is missing', async () => {
                const { repository } = createRepository(null)
                const { decrypt } = decryptMessageNode(stanza as any, 'me@s.whatsapp.net', 'me@lid', repository, createLogger())
                await decrypt()
                expect(repository.decryptMessage).toHaveBeenCalledWith(expect.objectContaining({ jid: pnJid }))
        })

        it('uses LID mapping when available', async () => {
                const lid = '111@s.whatsapp.net'
                const { repository } = createRepository(lid)
                const { decrypt } = decryptMessageNode(stanza as any, 'me@s.whatsapp.net', 'me@lid', repository, createLogger())
                await decrypt()
                expect(repository.decryptMessage).toHaveBeenCalledWith(expect.objectContaining({ jid: lid }))
        })
})
