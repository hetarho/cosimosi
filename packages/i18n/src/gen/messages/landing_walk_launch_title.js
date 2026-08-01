/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Walk_Launch_TitleInputs */

const en_landing_walk_launch_title = /** @type {(inputs: Landing_Walk_Launch_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Each scene rises as a star`)
};

const ko_landing_walk_launch_title = /** @type {(inputs: Landing_Walk_Launch_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`장면은 별이 되어 떠올라요`)
};

/**
* | output |
* | --- |
* | "Each scene rises as a star" |
*
* @param {Landing_Walk_Launch_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_walk_launch_title = /** @type {((inputs?: Landing_Walk_Launch_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Walk_Launch_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_walk_launch_title(inputs)
	return ko_landing_walk_launch_title(inputs)
});