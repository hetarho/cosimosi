package values

import "time"

// AccountWithdrawalRetentionWindow is the one Go-side duration derived from the generated
// account withdrawal policy scalar. Account behavior and platform admission share it.
func AccountWithdrawalRetentionWindow() time.Duration {
	return time.Duration(AccountWithdrawalRetentionDays) * 24 * time.Hour
}
