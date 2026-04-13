import {SIGN_POSITIVE} from "./mix-word.ts";

/**
 * Convert the given number to string with padding to the start.
 * @param x - number
 * @param maxLength - max length (default: 4), if x.toString() is shorter than maxLength,
 *                    insert additional padChar to the beginning.
 * @param padChar - default '0'
 */
export function formatNumber(x: number, maxLength: number = 4, padChar: string = '0'): string {
    return x.toString().padStart(maxLength, padChar);
}

/**
 * Convert a boolean to string. Default: Yes/No
 * @param b - boolean
 * @param trueValue
 * @param falseValue
 */
export function formatBoolean(b: boolean, trueValue: string = 'Yes', falseValue: string = 'No'): string {
    return b ? trueValue : falseValue;
}

/**
 * Format a sign field.
 * @param sign
 */
export function formatSign(sign: number): string {
    return formatBoolean(sign === SIGN_POSITIVE, '+', '-');
}