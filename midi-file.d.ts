declare module 'midi-file' {
    export function parseMidi(data: Uint8Array | ArrayBuffer): any;
    export function writeMidi(data: any): Uint8Array;
}
