import { jest } from '@jest/globals'
import { LIDMappingStore } from '../../Signal/lid-mapping'
import type { SignalKeyStoreWithTransaction } from '../../Types'

const mockKeyStore: SignalKeyStoreWithTransaction = {
	async get() {
		return {}
	},
	async set() {},
	isInTransaction: () => false,
	async transaction<T>(exec: () => Promise<T>) {
		return exec()
	}
}

describe('LIDMappingStore.getLIDForPN', () => {
	it('returns null when onWhatsAppFunc is missing', async () => {
		const store = new LIDMappingStore(mockKeyStore)
		await expect(store.getLIDForPN('1234567890@s.whatsapp.net')).resolves.toBeNull()
	})

	it('returns null when onWhatsAppFunc returns undefined', async () => {
		const onWhatsAppFunc = jest.fn(async () => undefined)
		const store = new LIDMappingStore(mockKeyStore, onWhatsAppFunc)
		await expect(store.getLIDForPN('1234567890@s.whatsapp.net')).resolves.toBeNull()
		expect(onWhatsAppFunc).toHaveBeenCalled()
	})
})
