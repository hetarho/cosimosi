/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Error_Memory_View_Semantic_Stage_Not_RisenInputs */

const en_error_memory_view_semantic_stage_not_risen = /** @type {(inputs: Error_Memory_View_Semantic_Stage_Not_RisenInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`This memory's gist is not ready yet.`)
};

const ko_error_memory_view_semantic_stage_not_risen = /** @type {(inputs: Error_Memory_View_Semantic_Stage_Not_RisenInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`아직 이 기억의 요지가 준비되지 않았어요.`)
};

/**
* | output |
* | --- |
* | "This memory's gist is not ready yet." |
*
* @param {Error_Memory_View_Semantic_Stage_Not_RisenInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const error_memory_view_semantic_stage_not_risen = /** @type {((inputs?: Error_Memory_View_Semantic_Stage_Not_RisenInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Error_Memory_View_Semantic_Stage_Not_RisenInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_error_memory_view_semantic_stage_not_risen(inputs)
	return ko_error_memory_view_semantic_stage_not_risen(inputs)
});