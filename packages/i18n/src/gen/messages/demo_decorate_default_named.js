/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ name: NonNullable<unknown> }} Demo_Decorate_Default_NamedInputs */

const en_demo_decorate_default_named = /** @type {(inputs: Demo_Decorate_Default_NamedInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.name} (default)`)
};

const ko_demo_decorate_default_named = /** @type {(inputs: Demo_Decorate_Default_NamedInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.name} (기본)`)
};

/**
* | output |
* | --- |
* | "{name} (default)" |
*
* @param {Demo_Decorate_Default_NamedInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_decorate_default_named = /** @type {((inputs: Demo_Decorate_Default_NamedInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Decorate_Default_NamedInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_decorate_default_named(inputs)
	return ko_demo_decorate_default_named(inputs)
});