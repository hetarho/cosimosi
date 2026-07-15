/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Deletion_Letgo_Resource_BodyInputs */

const en_deletion_letgo_resource_body = /** @type {(inputs: Deletion_Letgo_Resource_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`This app does not take the place of care. If your heart feels heavy, talking with a professional nearby can help.`)
};

const ko_deletion_letgo_resource_body = /** @type {(inputs: Deletion_Letgo_Resource_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이 앱은 치료를 대신하지 않아요. 마음이 많이 무겁다면 곁의 전문가에게 이야기해 보는 것도 좋아요.`)
};

/**
* | output |
* | --- |
* | "This app does not take the place of care. If your heart feels heavy, talking with a professional nearby can help." |
*
* @param {Deletion_Letgo_Resource_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const deletion_letgo_resource_body = /** @type {((inputs?: Deletion_Letgo_Resource_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletion_Letgo_Resource_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deletion_letgo_resource_body(inputs)
	return ko_deletion_letgo_resource_body(inputs)
});