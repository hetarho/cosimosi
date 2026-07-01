/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Universe_Renderer_UnavailableInputs */

const en_universe_renderer_unavailable = /** @type {(inputs: Universe_Renderer_UnavailableInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The 3D universe needs WebGPU, which isn't available here yet.`)
};

const ko_universe_renderer_unavailable = /** @type {(inputs: Universe_Renderer_UnavailableInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`3D 우주는 WebGPU가 필요한데 아직 사용할 수 없어요.`)
};

/**
* | output |
* | --- |
* | "The 3D universe needs WebGPU, which isn't available here yet." |
*
* @param {Universe_Renderer_UnavailableInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const universe_renderer_unavailable = /** @type {((inputs?: Universe_Renderer_UnavailableInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Universe_Renderer_UnavailableInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_universe_renderer_unavailable(inputs)
	return ko_universe_renderer_unavailable(inputs)
});