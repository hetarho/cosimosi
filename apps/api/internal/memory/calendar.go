package memory

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"time"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
)

type DiaryCalendarCursor struct {
	DiaryDate time.Time
}

type DiaryCalendarQuery struct {
	From      time.Time
	To        time.Time
	PageToken string
}

type DiaryDayMoodInput struct {
	DiaryDate    time.Time
	Mood         Mood
	BaseStrength float64
	RecallCount  int32
}

type DiaryDayMood struct {
	DiaryDate time.Time
	Mood      Mood
	Weight    float64
}

type DiaryDay struct {
	DiaryDate time.Time
	Moods     []DiaryDayMood
}

type DiaryCalendarPage struct {
	Days          []DiaryDay
	NextPageToken string
}

func (s *Service) GetDiaryCalendar(ctx context.Context, scope platform.UserScope, query DiaryCalendarQuery) (DiaryCalendarPage, error) {
	if scope.UserID() == "" {
		return DiaryCalendarPage{}, ErrScopeRequired
	}
	if query.From.IsZero() || query.To.IsZero() || query.From.After(query.To) {
		return DiaryCalendarPage{}, ErrDiaryDateRangeInvalid
	}

	var cursor *DiaryCalendarCursor
	if query.PageToken != "" {
		decoded, err := decodeDiaryCalendarCursor(query.PageToken)
		if err != nil {
			return DiaryCalendarPage{}, ErrDiaryPageTokenInvalid
		}
		cursor = &decoded
	}

	dates, err := s.diaries.DiaryDays(
		ctx,
		scope,
		query.From,
		query.To,
		cursor,
		values.DiaryReaderCalendarMonthPageSize,
	)
	if err != nil {
		return DiaryCalendarPage{}, err
	}
	hasMore := len(dates) > values.DiaryReaderCalendarMonthPageSize
	if hasMore {
		dates = dates[:values.DiaryReaderCalendarMonthPageSize]
	}

	var inputs []DiaryDayMoodInput
	if len(dates) > 0 {
		inputs, err = s.diaries.DiaryDayMoodInputs(ctx, scope, dates)
		if err != nil {
			return DiaryCalendarPage{}, err
		}
	}
	weights := make(map[string]map[Mood]float64, len(dates))
	validMoods := make(map[Mood]struct{}, len(AllMoods()))
	for _, mood := range AllMoods() {
		validMoods[mood] = struct{}{}
	}
	for _, input := range inputs {
		if _, ok := validMoods[input.Mood]; !ok {
			return DiaryCalendarPage{}, fmt.Errorf("calendar contains unknown mood %q", input.Mood)
		}
		key := input.DiaryDate.Format(time.DateOnly)
		if weights[key] == nil {
			weights[key] = make(map[Mood]float64)
		}
		weights[key][input.Mood] += EffectiveStrength(input.BaseStrength, input.RecallCount)
	}

	days := make([]DiaryDay, 0, len(dates))
	for _, date := range dates {
		day := DiaryDay{DiaryDate: date, Moods: make([]DiaryDayMood, 0)}
		for _, mood := range AllMoods() {
			weight, ok := weights[date.Format(time.DateOnly)][mood]
			if !ok {
				continue
			}
			day.Moods = append(day.Moods, DiaryDayMood{
				DiaryDate: date,
				Mood:      mood,
				Weight:    weight,
			})
		}
		days = append(days, day)
	}

	var next string
	if hasMore && len(dates) > 0 {
		next = encodeDiaryCalendarCursor(DiaryCalendarCursor{DiaryDate: dates[len(dates)-1]})
	}
	return DiaryCalendarPage{Days: days, NextPageToken: next}, nil
}

func encodeDiaryCalendarCursor(cursor DiaryCalendarCursor) string {
	return base64.RawURLEncoding.EncodeToString([]byte(cursor.DiaryDate.Format(time.DateOnly)))
}

func decodeDiaryCalendarCursor(token string) (DiaryCalendarCursor, error) {
	raw, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return DiaryCalendarCursor{}, err
	}
	date, err := time.Parse(time.DateOnly, string(raw))
	if err != nil {
		return DiaryCalendarCursor{}, errors.New("malformed diary calendar cursor")
	}
	return DiaryCalendarCursor{DiaryDate: date}, nil
}
