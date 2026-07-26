/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Tabs_LabelInputs */

const en_me_tabs_label = /** @type {(inputs: Me_Tabs_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Your account`)
};

const ko_me_tabs_label = /** @type {(inputs: Me_Tabs_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`나의 계정`)
};

/**
* | output |
* | --- |
* | "Your account" |
*
* @param {Me_Tabs_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_tabs_label = /** @type {((inputs?: Me_Tabs_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Tabs_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_tabs_label(inputs)
	return ko_me_tabs_label(inputs)
});