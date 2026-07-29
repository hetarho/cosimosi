/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Group_Background_TitleInputs */

const en_store_group_background_title = /** @type {(inputs: Store_Group_Background_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Sky`)
};

const ko_store_group_background_title = /** @type {(inputs: Store_Group_Background_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`배경`)
};

/**
* | output |
* | --- |
* | "Sky" |
*
* @param {Store_Group_Background_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_group_background_title = /** @type {((inputs?: Store_Group_Background_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Group_Background_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_group_background_title(inputs)
	return ko_store_group_background_title(inputs)
});