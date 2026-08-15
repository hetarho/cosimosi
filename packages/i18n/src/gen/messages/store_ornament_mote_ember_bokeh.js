/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Mote_Ember_BokehInputs */

const en_store_ornament_mote_ember_bokeh = /** @type {(inputs: Store_Ornament_Mote_Ember_BokehInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Ember Bokeh`)
};

const ko_store_ornament_mote_ember_bokeh = /** @type {(inputs: Store_Ornament_Mote_Ember_BokehInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`따뜻한 보케`)
};

/**
* | output |
* | --- |
* | "Ember Bokeh" |
*
* @param {Store_Ornament_Mote_Ember_BokehInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_mote_ember_bokeh = /** @type {((inputs?: Store_Ornament_Mote_Ember_BokehInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Mote_Ember_BokehInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_mote_ember_bokeh(inputs)
	return ko_store_ornament_mote_ember_bokeh(inputs)
});