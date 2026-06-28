/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Capability_State_MachineInputs */

const en_test_harness_capability_state_machine = /** @type {(inputs: Test_Harness_Capability_State_MachineInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`State machine`)
};

const ko_test_harness_capability_state_machine = /** @type {(inputs: Test_Harness_Capability_State_MachineInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`State machine`)
};

/**
* | output |
* | --- |
* | "State machine" |
*
* @param {Test_Harness_Capability_State_MachineInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_capability_state_machine = /** @type {((inputs?: Test_Harness_Capability_State_MachineInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Capability_State_MachineInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_capability_state_machine(inputs)
	return ko_test_harness_capability_state_machine(inputs)
});