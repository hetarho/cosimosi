package main

import (
	"context"
	"io"
	"log"
	"net"
	"net/http"
	"testing"
	"time"
)

// startServing runs serveHTTPServer on a loopback listener and reports when it returns.
func startServing(t *testing.T, ctx context.Context, handler http.Handler, shutdownTimeout time.Duration, cleanup func()) (string, <-chan error) {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	done := make(chan error, 1)
	go func() {
		done <- serveHTTPServer(ctx, &http.Server{Handler: handler}, listener, log.New(io.Discard, "", 0), shutdownTimeout, cleanup)
	}()
	return "http://" + listener.Addr().String(), done
}

// A request outliving the shutdown window is cut, and the domain and worker cleanup still runs —
// a timeout used to exit before either did.
func TestShutdownRunsCleanupAfterTimeout(t *testing.T) {
	entered := make(chan struct{})
	release := make(chan struct{})
	t.Cleanup(func() { close(release) })
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	cleaned := make(chan struct{})
	url, done := startServing(t, ctx, http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		close(entered)
		<-release
	}), 20*time.Millisecond, func() { close(cleaned) })

	requestErr := make(chan error, 1)
	go func() {
		response, err := http.Get(url)
		if err == nil {
			_ = response.Body.Close()
		}
		requestErr <- err
	}()
	<-entered
	cancel()

	select {
	case err := <-done:
		if err == nil {
			t.Fatal("shutdown past its window returned nil, want the timeout")
		}
	case <-time.After(5 * time.Second):
		t.Fatal("serveHTTPServer did not return after its shutdown window")
	}
	select {
	case <-cleaned:
	default:
		t.Fatal("cleanup did not run on the timeout path")
	}
	select {
	case err := <-requestErr:
		if err == nil {
			t.Fatal("the in-flight request completed; want its connection closed")
		}
	case <-time.After(5 * time.Second):
		t.Fatal("the in-flight request's connection was left open")
	}
}

func TestShutdownRunsCleanupOnACleanExit(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cleaned := make(chan struct{})
	_, done := startServing(t, ctx, http.NotFoundHandler(), time.Second, func() { close(cleaned) })
	cancel()
	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("clean shutdown err = %v", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("serveHTTPServer did not return")
	}
	select {
	case <-cleaned:
	default:
		t.Fatal("cleanup did not run on the clean path")
	}
}
