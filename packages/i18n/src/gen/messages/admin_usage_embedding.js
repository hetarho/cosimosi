/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Usage_EmbeddingInputs */

const en_admin_usage_embedding = /** @type {(inputs: Admin_Usage_EmbeddingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Embedding calls`)
};

const ko_admin_usage_embedding = /** @type {(inputs: Admin_Usage_EmbeddingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`임베딩 호출`)
};

/**
* | output |
* | --- |
* | "Embedding calls" |
*
* @param {Admin_Usage_EmbeddingInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_usage_embedding = /** @type {((inputs?: Admin_Usage_EmbeddingInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Usage_EmbeddingInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_usage_embedding(inputs)
	return ko_admin_usage_embedding(inputs)
});