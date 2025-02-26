import { Boom } from '@hapi/boom';
import NodeCache from 'node-cache';
import makeWASocket, {
    delay,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    makeInMemoryStore,
    useMultiFileAuthState,
    WAMessageKey
} from '../src';
import P from 'pino';

const logger = P({ timestamp: () => `,"time":"${new Date().toJSON()}"` }, P.destination('./wa-logs.txt'));
logger.level = 'trace';

const useStore = true;
const msgRetryCounterCache = new NodeCache();
const store = useStore ? makeInMemoryStore({ logger }) : undefined;

store?.readFromFile('./baileys_store_multi.json');
setInterval(() => store?.writeToFile('./baileys_store_multi.json'), 10_000);

// 📌 Enviar mensaje con botones interactivos (más compatible)
const sendButtonMessage = async (sock: any, recipientId: string) => {
    if (!recipientId) return console.error('❌ Error: recipientId es inválido');

    const templateButtons = [
        { index: 1, quickReplyButton: { displayText: "Opción 1", id: "id1" } },
        { index: 2, quickReplyButton: { displayText: "Opción 2", id: "id2" } }
    ];

    const buttonMessage = {
        text: "Hola, selecciona una opción:",
        footer: "Elige una opción",
        templateButtons
    };

    try {
        await sock.sendMessage(recipientId, buttonMessage);
        console.log(`✅ Botones enviados a ${recipientId}`);
    } catch (error) {
        console.error('❌ Error al enviar botones:', error);
    }
};

// 📌 Enviar mensaje interactivo con mejor compatibilidad
const sendInteractiveMessage = async (sock: any, recipientId: string) => {
    if (!recipientId) return console.error('❌ Error: recipientId es inválido');

    const templateButtons = [
        { index: 1, quickReplyButton: { displayText: "Responder", id: "quick_reply_id" } },
        { index: 2, urlButton: { displayText: "Ver Sitio", url: "https://www.example.com/" } },
        { index: 3, callButton: { displayText: "Llamar", phoneNumber: "+595985523065" } }
    ];

    const interactiveMessage = {
        text: "Este es un mensaje interactivo",
        footer: "Selecciona una opción",
        templateButtons
    };

    try {
        await sock.sendMessage(recipientId, interactiveMessage);
        console.log(`✅ Mensaje interactivo enviado a ${recipientId}`);
    } catch (error) {
        console.error('❌ Error al enviar mensaje interactivo:', error);
    }
};

// 📌 Iniciar conexión (SIN Pairing Code)
const startSock = async () => {
    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info');
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`✅ Usando WA v${version.join('.')}, isLatest: ${isLatest}`);

    const sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: true,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        msgRetryCounterCache,
        generateHighQualityLinkPreview: true,
        getMessage: async (key: WAMessageKey) => {
            if (store) {
                const msg = await store.loadMessage(key.remoteJid!, key.id!);
                return msg?.message || undefined;
            }
            return undefined;
        },
    });

    store?.bind(sock.ev);

    // 📌 Manejo de eventos
    sock.ev.process(async (events) => {
        if (events['connection.update']) {
            const update = events['connection.update'];
            const { connection, lastDisconnect } = update;

            if (connection === 'close') {
                if ((lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut) {
                    console.log('🔄 Reconectando...');
                    startSock();
                } else {
                    console.log('❌ Sesión cerrada.');
                }
            }
            console.log('🔄 Estado de conexión:', update);
        }

        if (events['creds.update']) {
            await saveCreds();
        }

        // 📌 Manejo de mensajes recibidos
        if (events['messages.upsert']) {
            const upsert = events['messages.upsert'];
            console.log('📩 Mensajes recibidos:', JSON.stringify(upsert, null, 2));

            if (upsert.type === 'notify') {
                for (const msg of upsert.messages) {
                    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';

                    if (text) {
                        const remoteJid = msg.key.remoteJid!;
                        if (text.toLowerCase() === "buttons") {
                            await sendButtonMessage(sock, remoteJid);
                        }
                        if (text.toLowerCase() === "pepe") {
                            await sendInteractiveMessage(sock, remoteJid);
                        }
                    }
                }
            }
        }
    });

    return sock;
};

// 🚀 Iniciar el bot
startSock();
