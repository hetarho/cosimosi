/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Walk_Recall_TitleInputs */

const en_landing_walk_recall_title = /** @type {(inputs: Landing_Walk_Recall_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Remembering brings one back`)
};

const ko_landing_walk_recall_title = /** @type {(inputs: Landing_Walk_Recall_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`떠올리면 돌아와요`)
};

/**
* | output |
* | --- |
* | "Remembering brings one back" |
*
* @param {Landing_Walk_Recall_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_walk_recall_title = /** @type {((inputs?: Landing_Walk_Recall_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Walk_Recall_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_walk_recall_title(inputs)
	return ko_landing_walk_recall_title(inputs)
});