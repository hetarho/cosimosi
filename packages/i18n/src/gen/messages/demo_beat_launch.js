/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Beat_LaunchInputs */

const en_demo_beat_launch = /** @type {(inputs: Demo_Beat_LaunchInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Send up the stars. Each scene becomes one, and the things it was about become the points it hangs from.`)
};

const ko_demo_beat_launch = /** @type {(inputs: Demo_Beat_LaunchInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`별 띄우기를 눌러보세요. 장면 하나가 별이 되고, 그 안에 있던 것들이 별을 붙드는 점이 돼요.`)
};

/**
* | output |
* | --- |
* | "Send up the stars. Each scene becomes one, and the things it was about become the points it hangs from." |
*
* @param {Demo_Beat_LaunchInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_beat_launch = /** @type {((inputs?: Demo_Beat_LaunchInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Beat_LaunchInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_beat_launch(inputs)
	return ko_demo_beat_launch(inputs)
});