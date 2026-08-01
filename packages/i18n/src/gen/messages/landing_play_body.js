/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Play_BodyInputs */

const en_landing_play_body = /** @type {(inputs: Landing_Play_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Write one line and it rises as a star. Leave it alone and it dims; recall it and it comes back. The star below is drawn the same way the real universe draws yours.`)
};

const ko_landing_play_body = /** @type {(inputs: Landing_Play_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`짧게 한 줄을 쓰면 그 문장이 별이 되어 떠오릅니다. 시간이 흐르는 동안 내버려 두면 어두워지고, 다시 떠올리면 돌아옵니다. 아래의 별은 실제 우주가 당신의 별을 그리는 방식 그대로 그려집니다.`)
};

/**
* | output |
* | --- |
* | "Write one line and it rises as a star. Leave it alone and it dims; recall it and it comes back. The star below is drawn the same way the real universe draws ..." |
*
* @param {Landing_Play_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_play_body = /** @type {((inputs?: Landing_Play_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Play_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_play_body(inputs)
	return ko_landing_play_body(inputs)
});