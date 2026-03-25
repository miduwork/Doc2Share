/**
/**
 * Simple LSB (Least Significant Bit) Steganography Encoder.
 * Injects a string into the pixel data of an image buffer.
 * 
 * Strategy:
 * 1. Convert string to bits.
 * 2. Modify the last bit of the Blue channel in consecutive pixels.
 * 3. Add a 32-bit header for length.
 */

export function encodeStego(pixelData: Uint8ClampedArray, message: string): Uint8ClampedArray {
    const binaryMessage = Array.from(message)
        .map((char) => char.charCodeAt(0).toString(2).padStart(8, "0"))
        .join("");

    // 32-bit header for message length
    const header = binaryMessage.length.toString(2).padStart(32, "0");
    const fullBits = header + binaryMessage;

    // We use the Blue channel (every 4th byte starting from index 2: R, G, B, A)
    if (fullBits.length > pixelData.length / 4) {
        throw new Error("Message too long for this image resolution.");
    }

    const result = new Uint8ClampedArray(pixelData);

    for (let i = 0; i < fullBits.length; i++) {
        const pixelIndex = i * 4 + 2; // Blue channel
        const bit = parseInt(fullBits[i], 10);

        // Set the LSB to the bit value
        result[pixelIndex] = (result[pixelIndex] & 0xFE) | bit;
    }

    return result;
}

/**
 * Decoder for verification/forensics.
 */
export function decodeStego(pixelData: Uint8ClampedArray): string | null {
    try {
        // 1. Read header (first 32 bits)
        let headerBits = "";
        for (let i = 0; i < 32; i++) {
            headerBits += (pixelData[i * 4 + 2] & 1).toString();
        }
        const messageLength = parseInt(headerBits, 2);

        if (messageLength <= 0 || messageLength > (pixelData.length - 32) * 8) {
            return null;
        }

        // 2. Read message bits
        let messageBits = "";
        for (let i = 0; i < messageLength; i++) {
            messageBits += (pixelData[(i + 32) * 4 + 2] & 1).toString();
        }

        // 3. Convert bits to string
        let message = "";
        for (let i = 0; i < messageBits.length; i += 8) {
            const charCode = parseInt(messageBits.slice(i, i + 8), 2);
            message += String.fromCharCode(charCode);
        }

        return message;
    } catch (err) {
        console.error("Stego decoding failed:", err);
        return null;
    }
}
