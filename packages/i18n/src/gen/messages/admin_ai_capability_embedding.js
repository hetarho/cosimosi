/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Ai_Capability_EmbeddingInputs */

const en_admin_ai_capability_embedding = /** @type {(inputs: Admin_Ai_Capability_EmbeddingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Embedding`)
};

const ko_admin_ai_capability_embedding = /** @type {(inputs: Admin_Ai_Capability_EmbeddingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`임베딩`)
};

/**
* | output |
* | --- |
* | "Embedding" |
*
* @param {Admin_Ai_Capability_EmbeddingInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_ai_capability_embedding = /** @type {((inputs?: Admin_Ai_Capability_EmbeddingInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Ai_Capability_EmbeddingInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_ai_capability_embedding(inputs)
	return ko_admin_ai_capability_embedding(inputs)
});