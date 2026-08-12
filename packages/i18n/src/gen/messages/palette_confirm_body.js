/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ mood: NonNullable<unknown> }} Palette_Confirm_BodyInputs */

const en_palette_confirm_body = /** @type {(inputs: Palette_Confirm_BodyInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.mood} will wear this color in your universe. You can change it again whenever you like.`)
};

const ko_palette_confirm_body = /** @type {(inputs: Palette_Confirm_BodyInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.mood}은(는) 이 색으로 우주에 남아요. 언제든 다시 바꿀 수 있어요.`)
};

/**
* | output |
* | --- |
* | "{mood} will wear this color in your universe. You can change it again whenever you like." |
*
* @param {Palette_Confirm_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const palette_confirm_body = /** @type {((inputs: Palette_Confirm_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Palette_Confirm_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_palette_confirm_body(inputs)
	return ko_palette_confirm_body(inputs)
});