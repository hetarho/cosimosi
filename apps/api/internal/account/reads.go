package account

// ReadService publishes profile-zone and invite-eligibility reads independently
// of reward grants, withdrawal scheduling and credential mutation.
type ReadService struct {
	store     Store
	directory Directory
}

func NewReadService(store Store, directory Directory) (*ReadService, error) {
	if store == nil {
		return nil, ErrStoreRequired
	}
	if directory == nil {
		return nil, ErrDirectoryRequired
	}
	return &ReadService{store: store, directory: directory}, nil
}
