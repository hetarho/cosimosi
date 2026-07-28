package account

import (
	"context"
	"fmt"
	"math"
	"regexp"
	"strconv"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
)

type Mood string
type Color string

const (
	MoodJoy        Mood = "JOY"
	MoodCalm       Mood = "CALM"
	MoodSad        Mood = "SAD"
	MoodAnger      Mood = "ANGER"
	MoodFear       Mood = "FEAR"
	MoodLove       Mood = "LOVE"
	MoodNeutral    Mood = "NEUTRAL"
	MoodExcitement Mood = "EXCITEMENT"
	MoodGratitude  Mood = "GRATITUDE"
	MoodRelief     Mood = "RELIEF"
	MoodStress     Mood = "STRESS"
	MoodTired      Mood = "TIRED"
	MoodEmptiness  Mood = "EMPTINESS"
)

var (
	allMoods = []Mood{
		MoodJoy, MoodCalm, MoodSad, MoodAnger, MoodFear, MoodLove, MoodNeutral,
		MoodExcitement, MoodGratitude, MoodRelief, MoodStress, MoodTired, MoodEmptiness,
	}
	validMoods = func() map[Mood]struct{} {
		moods := make(map[Mood]struct{}, len(allMoods))
		for _, mood := range allMoods {
			moods[mood] = struct{}{}
		}
		return moods
	}()
	colorPattern = regexp.MustCompile(`^#[0-9a-f]{6}$`)
)

type MoodColor struct {
	Mood  Mood
	Color Color
}

type MoodColorStatCount struct {
	Bucket      int32
	BucketCount int64
	TotalCount  int64
	SwatchColor Color
}

type MoodColorStat struct {
	Bucket      int32
	Share       *float64
	SwatchColor Color
}

func (s *Service) GetMoodColors(ctx context.Context, scope platform.UserScope) ([]MoodColor, error) {
	if scope.UserID() == "" {
		return nil, ErrScopeRequired
	}
	if err := s.requireSignup(ctx, scope); err != nil {
		return nil, err
	}
	return s.store.ListMoodColors(ctx, scope)
}

func (s *Service) SetMoodColor(
	ctx context.Context,
	scope platform.UserScope,
	mood Mood,
	color Color,
) (MoodColor, error) {
	if scope.UserID() == "" {
		return MoodColor{}, ErrScopeRequired
	}
	if err := s.requireSignup(ctx, scope); err != nil {
		return MoodColor{}, err
	}
	if !IsMood(mood) {
		return MoodColor{}, ErrMoodInvalid
	}
	if !colorPattern.MatchString(string(color)) {
		return MoodColor{}, ErrColorInvalid
	}
	snapped, err := SnapToEmotionStep(color)
	if err != nil {
		return MoodColor{}, err
	}
	return s.store.SetMoodColor(ctx, scope, MoodColor{Mood: mood, Color: snapped}, HueBucket(snapped))
}

func (s *Service) GetMoodColorStats(
	ctx context.Context,
	scope platform.UserScope,
	mood Mood,
) ([]MoodColorStat, error) {
	if scope.UserID() == "" {
		return nil, ErrScopeRequired
	}
	if err := s.requireSignup(ctx, scope); err != nil {
		return nil, err
	}
	if !IsMood(mood) {
		return nil, ErrMoodInvalid
	}
	counts, err := s.store.ListMoodColorStats(
		ctx,
		mood,
		int32(values.PaletteRecommendationCount),
	)
	if err != nil {
		return nil, err
	}
	stats := make([]MoodColorStat, 0, len(counts))
	for _, count := range counts {
		stat := MoodColorStat{Bucket: count.Bucket, SwatchColor: count.SwatchColor}
		if count.BucketCount >= int64(values.PaletteStatMinSample) && count.TotalCount > 0 {
			share := float64(count.BucketCount) / float64(count.TotalCount)
			stat.Share = &share
		}
		stats = append(stats, stat)
	}
	return stats, nil
}

func IsMood(mood Mood) bool {
	_, ok := validMoods[mood]
	return ok
}

type okLab struct {
	l float64
	a float64
	b float64
}

type okLch struct {
	l float64
	c float64
	h float64
}

var emotionLightnessSteps = []float64{0.8, 0.72, 0.63}

func SnapToEmotionStep(color Color) (Color, error) {
	lab, err := colorToOKLab(color)
	if err != nil {
		return "", err
	}
	lch := okLabToOKLCH(lab)
	nearest := emotionLightnessSteps[0]
	for _, step := range emotionLightnessSteps[1:] {
		if math.Abs(step-lch.l) < math.Abs(nearest-lch.l) {
			nearest = step
		}
	}
	lch.l = nearest
	target := okLCHToOKLab(lch)
	channels := okLabToLinearRGB(target)
	// A stored swatch must preserve the submitted hue and chroma. If the requested lightness
	// would leave sRGB by more than the unavoidable 8-bit encoding tolerance, clipping would
	// silently change those axes, so the server rejects the unsatisfiable color instead.
	const encodingTolerance = 2.0 / 255.0
	for _, channel := range channels {
		if channel < -encodingTolerance || channel > 1+encodingTolerance {
			return "", fmt.Errorf("%w: snapped color is outside sRGB gamut", ErrColorInvalid)
		}
	}
	return linearRGBToColor(channels), nil
}

func HueBucket(color Color) int32 {
	lab, err := colorToOKLab(color)
	if err != nil {
		return -1
	}
	lch := okLabToOKLCH(lab)
	if lch.c <= values.PaletteNearNeutralChromaMax {
		return int32(math.Ceil(360 / values.PaletteHueBucketDegrees))
	}
	return int32(math.Floor(lch.h / values.PaletteHueBucketDegrees))
}

func colorToOKLab(color Color) (okLab, error) {
	if !colorPattern.MatchString(string(color)) {
		return okLab{}, fmt.Errorf("%w: %q", ErrColorInvalid, color)
	}
	channels := [3]float64{}
	for index, offset := range []int{1, 3, 5} {
		value, err := strconv.ParseUint(string(color)[offset:offset+2], 16, 8)
		if err != nil {
			return okLab{}, fmt.Errorf("%w: %q", ErrColorInvalid, color)
		}
		channel := float64(value) / 255
		if channel <= 0.04045 {
			channels[index] = channel / 12.92
		} else {
			channels[index] = math.Pow((channel+0.055)/1.055, 2.4)
		}
	}
	lRoot := math.Cbrt(0.4122214708*channels[0] + 0.5363325363*channels[1] + 0.0514459929*channels[2])
	mRoot := math.Cbrt(0.2119034982*channels[0] + 0.6806995451*channels[1] + 0.1073969566*channels[2])
	sRoot := math.Cbrt(0.0883024619*channels[0] + 0.2817188376*channels[1] + 0.6299787005*channels[2])
	return okLab{
		l: 0.2104542553*lRoot + 0.793617785*mRoot - 0.0040720468*sRoot,
		a: 1.9779984951*lRoot - 2.428592205*mRoot + 0.4505937099*sRoot,
		b: 0.0259040371*lRoot + 0.7827717662*mRoot - 0.808675766*sRoot,
	}, nil
}

func okLabToLinearRGB(lab okLab) [3]float64 {
	lRoot := lab.l + 0.3963377774*lab.a + 0.2158037573*lab.b
	mRoot := lab.l - 0.1055613458*lab.a - 0.0638541728*lab.b
	sRoot := lab.l - 0.0894841775*lab.a - 1.291485548*lab.b
	l := math.Pow(lRoot, 3)
	m := math.Pow(mRoot, 3)
	s := math.Pow(sRoot, 3)
	return [3]float64{
		4.0767416621*l - 3.3077115913*m + 0.2309699292*s,
		-1.2684380046*l + 2.6097574011*m - 0.3413193965*s,
		-0.0041960863*l - 0.7034186147*m + 1.707614701*s,
	}
}

func linearRGBToColor(channels [3]float64) Color {
	result := "#"
	for _, channel := range channels {
		channel = math.Max(0, math.Min(1, channel))
		if channel <= 0.0031308 {
			channel *= 12.92
		} else {
			channel = 1.055*math.Pow(channel, 1/2.4) - 0.055
		}
		result += fmt.Sprintf("%02x", int(math.Round(channel*255)))
	}
	return Color(result)
}

func okLabToOKLCH(lab okLab) okLch {
	hue := math.Atan2(lab.b, lab.a) * 180 / math.Pi
	if hue < 0 {
		hue += 360
	}
	return okLch{l: lab.l, c: math.Hypot(lab.a, lab.b), h: hue}
}

func okLCHToOKLab(lch okLch) okLab {
	radians := lch.h * math.Pi / 180
	return okLab{
		l: lch.l,
		a: lch.c * math.Cos(radians),
		b: lch.c * math.Sin(radians),
	}
}
