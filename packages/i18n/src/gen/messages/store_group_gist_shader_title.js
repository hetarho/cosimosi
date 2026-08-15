/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Group_Gist_Shader_TitleInputs */

const en_store_group_gist_shader_title = /** @type {(inputs: Store_Group_Gist_Shader_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Gist shape`)
};

const ko_store_group_gist_shader_title = /** @type {(inputs: Store_Group_Gist_Shader_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`요지 모양`)
};

/**
* | output |
* | --- |
* | "Gist shape" |
*
* @param {Store_Group_Gist_Shader_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_group_gist_shader_title = /** @type {((inputs?: Store_Group_Gist_Shader_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Group_Gist_Shader_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_group_gist_shader_title(inputs)
	return ko_store_group_gist_shader_title(inputs)
});