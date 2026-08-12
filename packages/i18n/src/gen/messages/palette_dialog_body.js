/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Palette_Dialog_BodyInputs */

const en_palette_dialog_body = /** @type {(inputs: Palette_Dialog_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Whatever you choose shows in the preview above.`)
};

const ko_palette_dialog_body = /** @type {(inputs: Palette_Dialog_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`고른 색은 바로 위 미리보기에서 확인할 수 있어요.`)
};

/**
* | output |
* | --- |
* | "Whatever you choose shows in the preview above." |
*
* @param {Palette_Dialog_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const palette_dialog_body = /** @type {((inputs?: Palette_Dialog_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Palette_Dialog_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_palette_dialog_body(inputs)
	return ko_palette_dialog_body(inputs)
});