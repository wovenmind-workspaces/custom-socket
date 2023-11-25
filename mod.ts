import { BufReader, BufWriter } from "https://deno.land/std@0.91.0/io/bufio.ts";
import { handshake } from "https://deno.land/std@0.91.0/ws/mod.ts";
import WS from './ws.ts';

/**
 * Creates a websocket connection with custom headers!
 * 
 * @param url URL where the socket needs to be connected
 * @param headers An object of headers to send along
 * @example 
 * const ws = createSocketConnection('url', {
 *     Authorization: 'Bearer token'
 * })
 */
export async function createSocketConnection(
    url: string,
    headers: Record<string, string> = {}
): Promise<WS> {
    return new WS(await createConnection(url, headers));
}

/**
 * Returns connection details
 * 
 * @param url The url of the webpage to create socket connection
 * @param headers Your custom headers
 */
export async function createConnection(url: string, headers: Record<string, string> = {}): Promise<Connection> {
    const parsedURL = new URL(url);
    const { protocol, hostname, port } = parsedURL;
    let conn: Deno.Conn;

    if (protocol == 'http:' || protocol == 'ws:') {
        conn = await Deno.connect({ hostname, port: parseInt(port || '80') });
    } else if (protocol == 'https:' || protocol == 'wss:') {
        conn = await Deno.connectTls({ hostname, port: parseInt(port || '443') });
    } else {
        throw new Error('WS: Unknown protocol supplied to connect: ' + protocol);
    }

    const headersObject = new Headers();
    for (const header in headers) {
        headersObject.set(header, headers[header]);
    }

    const writableStream = new WritableStream({
        write(chunk) {
            return conn.write(chunk);
        },
        close() {
            conn.close();
        },
        abort(err) {
            console.error('Stream aborted:', err);
            conn.close();
        },
    });

    const readableStream = new ReadableStream({
        start(controller) {
            (async () => {
                try {
                    while (true) {
                        const buffer = new Uint8Array(1024);
                        const bytesRead = await conn.read(buffer);
                        if (bytesRead === null) {
                            break;
                        }
                        controller.enqueue(buffer.subarray(0, bytesRead));
                    }
                } catch (err) {
                    console.error('Error reading from connection:', err);
                } finally {
                    controller.close();
                    conn.close();
                }
            })();
        }
    });

    try {
        await handshake(parsedURL, headersObject, readableStream, writableStream);
    } catch (e) {
        conn.close();
        throw e;
    }

    return {
        conn,
        readableStream,
        writableStream,
        mask: createMask() // Assuming createMask is defined elsewhere
    };
}

/**
 * Connection properties required to connect with socket
 */
export interface Connection{
    conn: Deno.Conn;
    bufReader: BufReader;
    bufWriter: BufWriter;
    mask: Uint8Array;
}

/**
 * Creates mask for the createSocketConnection function!
 */
export function createMask(){
    return crypto.getRandomValues(new Uint8Array(4));
}

export { default } from "./ws.ts";
export type { Queue } from "./ws.ts";
