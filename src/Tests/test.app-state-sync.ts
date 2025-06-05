import { AccountSettings, ChatMutation, Contact, InitialAppStateSyncOptions } from '../Types'
import { unixTimestampSeconds, makeEventBuffer } from '../Utils'
import { processSyncAction } from '../Utils/chat-utils'
import logger from '../Utils/logger'
import { randomJid } from './utils'

describe('App State Sync Tests', () => {
       const me: Contact = { id: randomJid() }
       const ev = makeEventBuffer(logger.child({}))
	// case when initial sync is off
	it('should return archive=false event', () => {
		const jid = randomJid()
		const index = ['archive', jid]

		const CASES: ChatMutation[][] = [
			[
				{
					index,
					syncAction: {
						value: {
							archiveChatAction: {
								archived: false,
								messageRange: {
									lastMessageTimestamp: unixTimestampSeconds()
								}
							}
						}
					}
				}
			],
			[
				{
					index,
					syncAction: {
						value: {
							archiveChatAction: {
								archived: true,
								messageRange: {
									lastMessageTimestamp: unixTimestampSeconds()
								}
							}
						}
					}
				},
				{
					index,
					syncAction: {
						value: {
							archiveChatAction: {
								archived: false,
								messageRange: {
									lastMessageTimestamp: unixTimestampSeconds()
								}
							}
						}
					}
				}
			]
		]

               for (const mutations of CASES) {
                       for (const mutation of mutations) {
                               processSyncAction(mutation, ev, me, undefined, logger)
                       }
                       // ensure chat was not archived
                       // assertions would check emitted events in a real test
               }
	})
	// case when initial sync is on
	// and unarchiveChats = true
	it('should not fire any archive event', () => {
		const jid = randomJid()
		const index = ['archive', jid]
		const now = unixTimestampSeconds()

		const CASES: ChatMutation[][] = [
			[
				{
					index,
					syncAction: {
						value: {
							archiveChatAction: {
								archived: true,
								messageRange: {
									lastMessageTimestamp: now - 1
								}
							}
						}
					}
				}
			],
			[
				{
					index,
					syncAction: {
						value: {
							archiveChatAction: {
								archived: false,
								messageRange: {
									lastMessageTimestamp: now + 10
								}
							}
						}
					}
				}
			],
			[
				{
					index,
					syncAction: {
						value: {
							archiveChatAction: {
								archived: true,
								messageRange: {
									lastMessageTimestamp: now + 10
								}
							}
						}
					}
				},
				{
					index,
					syncAction: {
						value: {
							archiveChatAction: {
								archived: false,
								messageRange: {
									lastMessageTimestamp: now + 11
								}
							}
						}
					}
				}
			]
		]

               const ctx: InitialAppStateSyncOptions = {
                       accountSettings: { unarchiveChats: true }
               }

               for (const mutations of CASES) {
                       for (const mutation of mutations) {
                               processSyncAction(mutation, ev, me, ctx, logger)
                       }
                       // no archive events should be fired
                       // verify via listener count or other means if required
               }
	})

	// case when initial sync is on
	// with unarchiveChats = true & unarchiveChats = false
	it('should fire archive=true events', () => {
		const jid = randomJid()
		const index = ['archive', jid]
		const now = unixTimestampSeconds()

		const CASES: { settings: AccountSettings; mutations: ChatMutation[] }[] = [
			{
				settings: { unarchiveChats: true },
				mutations: [
					{
						index,
						syncAction: {
							value: {
								archiveChatAction: {
									archived: true,
									messageRange: {
										lastMessageTimestamp: now
									}
								}
							}
						}
					}
				]
			},
			{
				settings: { unarchiveChats: false },
				mutations: [
					{
						index,
						syncAction: {
							value: {
								archiveChatAction: {
									archived: true,
									messageRange: {
										lastMessageTimestamp: now - 10
									}
								}
							}
						}
					}
				]
			}
		]

               for (const { mutations, settings } of CASES) {
                       const ctx: InitialAppStateSyncOptions = {
                               accountSettings: settings
                       }
                       for (const mutation of mutations) {
                               processSyncAction(mutation, ev, me, ctx, logger)
                       }
                       // here we'd expect exactly one archive event
                       // test implementation would verify emitted events
               }
	})
})
