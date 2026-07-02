package memory

import "github.com/cosimosi/api/internal/platform/values"

type Mood string

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

type EmotionQuadrant string

const (
	EmotionQuadrantPositiveHighArousal EmotionQuadrant = "positive_high_arousal"
	EmotionQuadrantPositiveLowArousal  EmotionQuadrant = "positive_low_arousal"
	EmotionQuadrantNegativeHighArousal EmotionQuadrant = "negative_high_arousal"
	EmotionQuadrantNegativeLowArousal  EmotionQuadrant = "negative_low_arousal"
	EmotionQuadrantNeutral             EmotionQuadrant = "neutral"
)

type EmotionCoordinate struct {
	Valence float64
	Arousal float64
}

type Emotion struct {
	Mood      Mood
	Valence   float64
	Arousal   float64
	Intensity float64
}

var moodQuadrants = map[Mood]EmotionQuadrant{
	MoodJoy:        EmotionQuadrantPositiveHighArousal,
	MoodExcitement: EmotionQuadrantPositiveHighArousal,
	MoodLove:       EmotionQuadrantPositiveHighArousal,
	MoodCalm:       EmotionQuadrantPositiveLowArousal,
	MoodGratitude:  EmotionQuadrantPositiveLowArousal,
	MoodRelief:     EmotionQuadrantPositiveLowArousal,
	MoodAnger:      EmotionQuadrantNegativeHighArousal,
	MoodFear:       EmotionQuadrantNegativeHighArousal,
	MoodStress:     EmotionQuadrantNegativeHighArousal,
	MoodSad:        EmotionQuadrantNegativeLowArousal,
	MoodTired:      EmotionQuadrantNegativeLowArousal,
	MoodEmptiness:  EmotionQuadrantNegativeLowArousal,
	MoodNeutral:    EmotionQuadrantNeutral,
}

func AllMoods() []Mood {
	return []Mood{
		MoodJoy,
		MoodCalm,
		MoodSad,
		MoodAnger,
		MoodFear,
		MoodLove,
		MoodNeutral,
		MoodExcitement,
		MoodGratitude,
		MoodRelief,
		MoodStress,
		MoodTired,
		MoodEmptiness,
	}
}

func MoodQuadrant(mood Mood) (EmotionQuadrant, bool) {
	quadrant, ok := moodQuadrants[mood]
	return quadrant, ok
}

func MoodCoordinate(mood Mood) (EmotionCoordinate, bool) {
	key, ok := moodValueKey(mood)
	if !ok {
		return EmotionCoordinate{}, false
	}
	valence, ok := values.EmotionMoodValence[key]
	if !ok {
		return EmotionCoordinate{}, false
	}
	arousal, ok := values.EmotionMoodArousal[key]
	if !ok {
		return EmotionCoordinate{}, false
	}
	return EmotionCoordinate{Valence: valence, Arousal: arousal}, true
}

func NewEmotion(mood Mood) (Emotion, bool) {
	return NewEmotionWithIntensity(mood, values.EmotionDefaultIntensity)
}

func NewEmotionWithIntensity(mood Mood, intensity float64) (Emotion, bool) {
	coordinate, ok := MoodCoordinate(mood)
	if !ok {
		return Emotion{}, false
	}
	return Emotion{
		Mood:      mood,
		Valence:   coordinate.Valence,
		Arousal:   coordinate.Arousal,
		Intensity: intensity,
	}, true
}

func ArousalToInitialStrength(arousal float64) float64 {
	if arousal < 0 {
		arousal = 0
	}
	if arousal > 1 {
		arousal = 1
	}
	return values.EmotionArousalStrengthMin + arousal*(values.EmotionArousalStrengthMax-values.EmotionArousalStrengthMin)
}

func moodValueKey(mood Mood) (string, bool) {
	switch mood {
	case MoodJoy:
		return "joy", true
	case MoodCalm:
		return "calm", true
	case MoodSad:
		return "sad", true
	case MoodAnger:
		return "anger", true
	case MoodFear:
		return "fear", true
	case MoodLove:
		return "love", true
	case MoodNeutral:
		return "neutral", true
	case MoodExcitement:
		return "excitement", true
	case MoodGratitude:
		return "gratitude", true
	case MoodRelief:
		return "relief", true
	case MoodStress:
		return "stress", true
	case MoodTired:
		return "tired", true
	case MoodEmptiness:
		return "emptiness", true
	default:
		return "", false
	}
}
