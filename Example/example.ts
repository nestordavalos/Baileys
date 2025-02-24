import { Boom } from '@hapi/boom'
import NodeCache from 'node-cache'
import readline from 'readline'
import makeWASocket, { AnyMessageContent, BinaryInfo, delay, DisconnectReason, downloadAndProcessHistorySyncNotification, encodeWAM, fetchLatestBaileysVersion, getAggregateVotesInPollMessage, getHistoryMsg, isJidNewsletter, makeCacheableSignalKeyStore, makeInMemoryStore, proto, useMultiFileAuthState, WAMessageContent, WAMessageKey } from '../src'
//import MAIN_LOGGER from '../src/Utils/logger'
import open from 'open'
import fs from 'fs'
import P from 'pino'

const logger = P({ timestamp: () => `,"time":"${new Date().toJSON()}"` }, P.destination('./wa-logs.txt'))
logger.level = 'trace'

const useStore = !process.argv.includes('--no-store')
const doReplies = process.argv.includes('--do-reply')
const usePairingCode = process.argv.includes('--use-pairing-code')

const msgRetryCounterCache = new NodeCache()
const onDemandMap = new Map<string, string>()

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const question = (text: string) => new Promise<string>((resolve) => rl.question(text, resolve))

const store = useStore ? makeInMemoryStore({ logger }) : undefined
store?.readFromFile('./baileys_store_multi.json')
setInterval(() => {
	store?.writeToFile('./baileys_store_multi.json')
}, 10_000)

// 📌 Función para enviar un mensaje con botones
const sendButtonMessage = async (sock, recipientId) => {
    const buttons = [
        { buttonId: 'id1', buttonText: { displayText: 'Button 1' }, type: 1 },
        { buttonId: 'id2', buttonText: { displayText: 'Button 2' }, type: 1 }
    ]

    const buttonMessage = {
        text: "Hi, it's a button message",
        footer: 'Hello World',
        buttons,
        headerType: 1,
        viewOnce: true
    }

    try {
        await sock.sendMessage(recipientId, buttonMessage)
        console.log('✅ Mensaje de botones enviado correctamente')
    } catch (error) {
        console.error('❌ Error al enviar el mensaje de botones:', error)
    }
}

// 📌 Iniciar conexión con Baileys
const startSock = async () => {
	const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info')
	const { version, isLatest } = await fetchLatestBaileysVersion()
	console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`)

	const sock = makeWASocket({
		version,
		logger,
		printQRInTerminal: !usePairingCode,
		auth: {
			creds: state.creds,
			keys: makeCacheableSignalKeyStore(state.keys, logger),
		},
		msgRetryCounterCache,
		generateHighQualityLinkPreview: true,
		getMessage,
	})

	store?.bind(sock.ev)

	if (usePairingCode && !sock.authState.creds.registered) {
		const phoneNumber = await question('Please enter your phone number:\n')
		const code = await sock.requestPairingCode(phoneNumber)
		console.log(`Pairing code: ${code}`)
	}

	// 📌 Enviar mensaje con efecto de escritura
	const sendMessageWTyping = async(msg, jid) => {
		await sock.presenceSubscribe(jid)
		await delay(500)

		await sock.sendPresenceUpdate('composing', jid)
		await delay(2000)

		await sock.sendPresenceUpdate('paused', jid)
		await sock.sendMessage(jid, msg)
	}

	// 📌 Procesar eventos de conexión y mensajes
	sock.ev.process(async (events) => {
		if (events['connection.update']) {
			const update = events['connection.update']
			const { connection, lastDisconnect } = update
			if (connection === 'close') {
				if ((lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut) {
					startSock()
				} else {
					console.log('Connection closed. You are logged out.')
				}
			}

			console.log('connection update', update)

			// 📌 Enviar mensaje de botones cuando la conexión esté abierta
			if (connection === 'open') {
				const recipientId = '595985523065@s.whatsapp.net' // 🔹 Reemplázalo con un número válido
				await sendButtonMessage(sock, recipientId)
			}
		}

		if (events['creds.update']) {
			await saveCreds()
		}

		// 📌 Detectar mensajes recibidos y responder automáticamente
		if (events['messages.upsert']) {
			const upsert = events['messages.upsert']
			console.log('📩 Mensajes recibidos:', JSON.stringify(upsert, null, 2))

			if (upsert.type === 'notify') {
				for (const msg of upsert.messages) {
					if (msg.message?.conversation || msg.message?.extendedTextMessage?.text) {
						const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text
						
						// 📌 Si el mensaje recibido es "buttons", enviamos un mensaje con botones
						if (text && text.toLowerCase() === "buttons") {
							await sendButtonMessage(sock, msg.key.remoteJid!)
						}
						
						// 📌 Respuesta automática si no es un newsletter
						if (!msg.key.fromMe && doReplies && !isJidNewsletter(msg.key.remoteJid!)) {
							console.log('🔹 Respondiendo a', msg.key.remoteJid)
							await sock.readMessages([msg.key])
							await sendMessageWTyping({ text: '👋 ¡Hola! ¿Cómo puedo ayudarte?' }, msg.key.remoteJid!)
						}
					}
				}
			}
		}
	})

	return sock
}

// 📌 Función auxiliar para obtener mensajes previos
async function getMessage(key) {
	if (store) {
		const msg = await store.loadMessage(key.remoteJid!, key.id!)
		return msg?.message || undefined
	}
	return proto.Message.fromObject({})
}

// 🚀 Iniciar el bot
startSock()
