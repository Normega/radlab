import { useState, useEffect, useRef, useCallback } from 'react';
import ProgressLabel from './ProgressLabel';
import InstructionScreen from './InstructionScreen';
import ScaleChangeScreen from './ScaleChangeScreen';
import LikertItem from './LikertItem';
import ChecklistScreen from './ChecklistScreen';
import { buildSlides, prevNavigableIndex, effectiveLabels, isEndpointOnly,
         computeSubscaleScores, computeDerivedScores,
         isChecklistType, checklistItemResponse,
         normalizeChecklistResponses, computeChecklistTotal } from './questionnaireUtils';

const FADE_MS = 150; // slide transition duration

// ── QuestionnaireRenderer ──────────────────────────────────────────────────
//
// Full questionnaire player. Builds a flat slide sequence from the definition,
// manages responses, handles back navigation, and fires onComplete when done.
//
// Props:
//   questionnaire   — full JSON definition
//   partNumber      — 1-based (for progress label); default 1
//   totalParts      — total parts in session (for progress label); default 1
//   onComplete      — ({ responses, subscaleScores, derivedScores }) => void
//   onBack          — optional () => void — called if back pressed on instruction slide
//   previewMode     — bool — shows "Preview complete" at end instead of calling onComplete

export default function QuestionnaireRenderer({
  questionnaire,
  partNumber  = 1,
  totalParts  = 1,
  onComplete,
  onBack,
  previewMode = false,
  isSimMode   = false,
}) {
  const [slides]  = useState(() => buildSlides(questionnaire)); // built once per mount
  const [slideIdx,   setSlideIdx]   = useState(0);
  const [responses,  setResponses]  = useState({});
  const [visible,    setVisible]    = useState(true);  // fade control
  const [done,       setDone]       = useState(false);
  const transitioningRef = useRef(false);
  // onComplete must fire at most once per mount. The last item's advance() calls
  // finish() directly, bypassing goTo()'s transitioningRef guard — so without
  // this a double-tap on the final answer fires onComplete twice, and the parent
  // (SessionEntry) advances two steps, silently skipping the next one (a
  // questionnaire, or the debrief). SessionEntry remounts this per step
  // (key={currentIndex}), so a per-mount ref resets correctly each step.
  const finishedRef = useRef(false);

  const isChecklist = isChecklistType(questionnaire);

  // Finalize the questionnaire: normalize (checklist), score, and report.
  const finish = useCallback((current) => {
    if (previewMode) { setDone(true); return; }
    if (finishedRef.current) return;
    finishedRef.current = true;
    const finalResponses = isChecklist
      ? normalizeChecklistResponses(questionnaire, current)
      : current;
    const subscaleScores = computeSubscaleScores(questionnaire, finalResponses);
    const derivedScores  = computeDerivedScores(questionnaire, subscaleScores);
    const payload = { responses: finalResponses, subscaleScores, derivedScores };
    if (isChecklist) payload.totalScore = computeChecklistTotal(questionnaire, finalResponses);
    onComplete?.(payload);
  }, [isChecklist, questionnaire, onComplete, previewMode]);

  // Sim mode: after a brief mount delay, fill all item responses and complete
  useEffect(() => {
    if (!isSimMode) return;
    const t = setTimeout(() => {
      const simResponses = {};
      if (isChecklist) {
        for (const item of questionnaire.items ?? []) {
          const checked = Math.random() < 0.5;
          const count   = !checked ? 0
            : item.allow_multiple ? 1 + Math.floor(Math.random() * 3) : 1;
          simResponses[item.id] = checklistItemResponse(item, count);
        }
      } else {
        for (const slide of slides) {
          if (slide.type !== 'item') continue;
          const item   = slide.item;
          const labels = effectiveLabels(item, questionnaire);
          const min    = labels[0]?.value ?? 1;
          const max    = labels[labels.length - 1]?.value ?? 5;
          simResponses[item.id] = Math.floor(Math.random() * (max - min + 1)) + min;
        }
      }
      finish(simResponses);
    }, 300);
    return () => clearTimeout(t);
  }, [isSimMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentSlide = slides[slideIdx];
  // Checklist questionnaires always use the Next button — advancing on every
  // checkbox toggle would end the questionnaire on the first endorsement.
  const autoAdvance  = questionnaire.auto_advance !== false && !isChecklist; // default true

  // ── Transition helper — fade out, advance, fade in ─────────────────────
  const goTo = useCallback(async (nextIdx) => {
    if (transitioningRef.current) return;
    transitioningRef.current = true;
    setVisible(false);
    await new Promise(r => setTimeout(r, FADE_MS));
    setSlideIdx(nextIdx);
    setVisible(true);
    transitioningRef.current = false;
  }, []);

  // ── Advance to next slide ──────────────────────────────────────────────
  // responsesOverride: pass freshly-updated responses from handleSelect so we
  // don't read a stale closure value on the very last item.
  const advance = useCallback((responsesOverride) => {
    const current = responsesOverride ?? responses;
    const next = slideIdx + 1;
    if (next >= slides.length) {
      // All items answered — complete
      finish(current);
    } else {
      goTo(next);
    }
  }, [slideIdx, slides.length, responses, finish, goTo]);

  // ── Back navigation ────────────────────────────────────────────────────
  const goBack = useCallback(() => {
    if (slideIdx === 0) {
      onBack?.();
      return;
    }
    const prev = prevNavigableIndex(slides, slideIdx);
    goTo(prev);
  }, [slideIdx, slides, onBack, goTo]);

  // ── Item response handler ──────────────────────────────────────────────
  const handleSelect = useCallback((itemId, value) => {
    const updated = { ...responses, [itemId]: value };
    setResponses(updated);
    if (autoAdvance) {
      // Pass updated responses directly so advance doesn't read stale state
      advance(updated);
    }
    // Manual mode: user taps Next button (rendered below)
  }, [autoAdvance, advance, responses]);

  // Checklist checkbox/stepper handler. Takes an updater (prevCount => nextCount)
  // and resolves it against the true previous state inside the React updater,
  // not a value captured at click time — otherwise rapid taps race and clobber
  // each other (each reading the same stale count before a re-render lands).
  const handleChecklistChange = useCallback((item, updateCount) => {
    setResponses(prev => {
      const prevCount = prev[item.id]?.occurrence_count ?? 0;
      return { ...prev, [item.id]: checklistItemResponse(item, updateCount(prevCount)) };
    });
  }, []);

  if (done && previewMode) {
    return (
      <div
        style={{
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          minHeight:      '60vh',
          gap:            16,
          color:          'var(--tx2)',
          fontFamily:     'DM Sans',
          fontSize:       'var(--fs-body)',
        }}
      >
        <span style={{ fontSize: 36 }}>✓</span>
        <p>
          {isChecklist
            ? `Preview complete — ${Object.values(responses).filter(r => (r?.occurrence_count ?? 0) > 0).length} items endorsed.`
            : `Preview complete — ${Object.keys(responses).length} items answered.`}
        </p>
      </div>
    );
  }

  // ── Progress label data (only for item slides) ─────────────────────────
  const isItemSlide      = currentSlide?.type === 'item';
  const isChecklistSlide = currentSlide?.type === 'checklist';
  const labels = isItemSlide ? effectiveLabels(currentSlide.item, questionnaire) : null;
  const currentResponse = isItemSlide ? responses[currentSlide.item.id] ?? null : null;

  // Can the Next button be shown? (manual mode: need a response)
  // Checklist: always — endorsing zero items is a valid response.
  const showNext = (!autoAdvance && isItemSlide) || isChecklistSlide;
  const canNext  = isChecklistSlide || (showNext && currentResponse !== null);

  // Show back button on all slides (disabled on instruction with no onBack)
  const backDisabled = slideIdx === 0 && !onBack;

  return (
    <div
      style={{
        minHeight:  '100vh',
        background: 'var(--bg)',
        display:    'flex',
        flexDirection: 'column',
      }}
    >
      {/* Progress label — sticky top, only on item slides */}
      <ProgressLabel
        partNumber={partNumber}
        totalParts={totalParts}
        partName={questionnaire.name}
        itemIndex={isItemSlide ? currentSlide.itemDisplayIndex : null}
        totalItems={isItemSlide ? currentSlide.totalItems : null}
        instructions={isItemSlide ? questionnaire.instructions : null}
      />

      {/* Slide content — fade transition */}
      <div
        style={{
          flex:       1,
          opacity:    visible ? 1 : 0,
          transition: `opacity ${FADE_MS}ms ease`,
        }}
      >
        {/* Callbacks wrap advance() so DOM click events are never passed in
            as the responsesOverride argument. */}
        {currentSlide?.type === 'instruction' && (
          <InstructionScreen
            questionnaire={questionnaire}
            onBegin={() => advance()}
          />
        )}

        {currentSlide?.type === 'scale_change' && (
          <ScaleChangeScreen
            slide={currentSlide}
            onContinue={() => advance()}
          />
        )}

        {isChecklistSlide && (
          <ChecklistScreen
            items={currentSlide.items}
            responses={responses}
            onChange={handleChecklistChange}
          />
        )}

        {currentSlide?.type === 'item' && (
          <LikertItem
            item={currentSlide.item}
            labels={labels}
            selectedValue={currentResponse}
            onSelect={(value) => handleSelect(currentSlide.item.id, value)}
            autoAdvance={autoAdvance}
            endpointOnly={isEndpointOnly(labels)}
          />
        )}
      </div>

      {/* ── Fixed bottom bar — Back (left) + Next if manual (right) ────── */}
      <div
        style={{
          position:   'fixed',
          bottom:     0,
          left:       0,
          right:      0,
          display:    'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding:    '16px 24px',
          // Transparent — only buttons are visible; no background bar
          pointerEvents: 'none', // pass clicks through empty areas
        }}
      >
        {/* Back button — fixed bottom-left */}
        <button
          onClick={goBack}
          disabled={backDisabled}
          style={{
            pointerEvents:  'auto',
            background:     backDisabled ? 'transparent' : 'var(--bgc)',
            color:          backDisabled ? 'var(--tx3)' : 'var(--tx2)',
            border:         `1px solid ${backDisabled ? 'transparent' : 'var(--bd)'}`,
            borderRadius:   12,
            padding:        '10px 18px',
            fontFamily:     'DM Sans',
            fontSize:       'var(--fs-body-sm)',
            cursor:         backDisabled ? 'default' : 'pointer',
            opacity:        backDisabled ? 0 : 1,
            transition:     'opacity 200ms ease',
            boxShadow:      backDisabled ? 'none' : '0 2px 8px rgba(0,0,0,0.08)',
          }}
        >
          ← Back
        </button>

        {/* Next button — bottom-right, manual-mode item slides + checklist */}
        {showNext ? (
          <button
            onClick={() => advance()}
            disabled={!canNext}
            style={{
              pointerEvents:  'auto',
              background:     canNext ? 'var(--pk)' : 'var(--bd)',
              color:          canNext ? '#fff' : 'var(--tx3)',
              border:         'none',
              borderRadius:   12,
              padding:        '10px 24px',
              fontFamily:     'DM Sans',
              fontSize:       'var(--fs-body-sm)',
              fontWeight:     600,
              cursor:         canNext ? 'pointer' : 'default',
              boxShadow:      canNext ? '0 2px 8px rgba(240,104,164,0.25)' : 'none',
              transition:     'background 200ms ease, box-shadow 200ms ease',
            }}
          >
            Next →
          </button>
        ) : (
          // Spacer so Back stays left-aligned
          <span style={{ pointerEvents: 'none' }} />
        )}
      </div>

      {/* Bottom padding so content clears the fixed bar */}
      <div style={{ height: 72 }} />
    </div>
  );
}
