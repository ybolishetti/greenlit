# Greenlit Business Plan — Technical Architecture Amendment

**Date:** 2026-07-05
**Supersedes:** "Tech Stack Decision" section of primary business plan (dated pre-web-MVP)
**Status:** Locked between Yash + cofounder

---

## Why this amendment

The primary business plan predates the web MVP (now live at greenlit-six.vercel.app) and describes Greenlit's diagnostic engine as a single fine-tuned model. Real design decisions since MVP launch have converged on a **two-model + rules-layer architecture** that separates diagnostic reasoning from user-facing question generation. This amendment documents that architecture, its data requirements, and its evolution path.

The consumer product, business model, and go-to-market remain unchanged. This amendment is scoped to the AI system.

---

## Architecture: Interviewer + Diagnostician

Greenlit's diagnostic engine is composed of three components: two LLM-based models with distinct roles, and a deterministic rules layer that sits between them. This separation is deliberate — it isolates safety-critical reasoning from user-experience concerns, enables the two models to be sized and fine-tuned independently, and keeps the UI decision-making explainable.

### Component roles

**Diagnostician (Model B)** — the diagnostic brain.
Ingests all captured symptom evidence (audio, video, photo, sliders, text, prior Q&A) and produces either (a) a running hypothesis identifying diagnostic gaps, or (b) a final mechanic-ready brief with ranked probable causes, urgency, and components to inspect. This is the model that needs domain-specific fine-tuning. It never speaks to the user directly.

**Interviewer (Model A)** — the user-facing question layer.
Takes the Diagnostician's identified gaps and produces plain-language, non-technical questions the driver can answer. Never performs diagnostic reasoning. May be a substantially smaller/cheaper model than the Diagnostician because its task is language generation, not reasoning.

**Rules layer** — deterministic UI selection.
Between the Diagnostician's identified information gap and the Interviewer's plain-language question, a deterministic lookup layer selects the appropriate UI element (slider, multiple-choice, media request, free text, toggle). This is intentionally not an LLM decision — UI selection is a bounded, explainable mapping problem and doesn't benefit from generative reasoning.

### Runtime flow

```
Step 0: Vehicle context capture
        (year / make / model / mileage — first-class field, required)
          ↓
Step 1: Initial multimodal capture
        (audio / video / photo / text / feel sliders — user picks one to start)
          ↓
Cycle loop (max 3 rounds):
   ├── Diagnostician analyzes accumulated evidence
   │       ↓ produces: current confidence, ranked hypotheses, info gaps
   ├── Rules layer maps info gaps → UI component types
   ├── Interviewer generates plain-language question text (3–5 per round)
   ├── User answers → answers appended to evidence
   └── Loop continues unless termination triggered
          ↓
Termination triggers (any):
   • Diagnostician confidence ≥ 0.75
   • 3 cycles complete
   • 5–8 total questions asked
   • User taps "Done"
          ↓
Diagnostician produces final brief (ranked causes, urgency, components,
customer's exact language preserved, disclaimer)
```

### Model firing cadence

The Diagnostician fires **once per cycle**, not once per question. Questions are batched (3–5 per cycle), and the Diagnostician reasons over the batch of answers before generating the next round of gaps. This design choice reduces latency, reduces API cost, and better matches how mechanics actually think (they don't re-evaluate the whole case after every customer word — they let the customer finish a thought, then integrate).

---

## Data strategy

The two models require fundamentally different training data. Conflating them was a design error in the original business plan. This amendment corrects that.

### Diagnostician training data

The Diagnostician needs **annotated intake conversation traces** — not just symptom→cause pairs. A training example looks like:

```
Given: [initial customer description] + [round 1 Q&A]
The mechanic's best next question was: [X]
Because: it narrows between hypothesis [Y] and [Z]
```

This is a harder data problem than a flat symptom→diagnosis lookup, but it produces a model that learns *how to think diagnostically*, not just what the correct answer is.

**Sourcing plan (in order of priority):**

1. **Shop shadowing (cofounder-led, phase 1).** Cofounder uses his German shop contacts remotely to capture real intake conversations. Goal: 100+ annotated conversations in 4–8 weeks. Consent obtained; customer identity redacted.
2. **Cofounder as annotator (phase 2).** As a certified mechanic, cofounder is the highest-leverage labeler on the team. He annotates the "next best question" and "final diagnosis" fields on raw data we collect (from forums, product usage, or third-party sources). This is his most defensible contribution.
3. **Local partner shop (Charlottesville, phase 2).** Yash pursues one Charlottesville shop for a 12-week structured data collection pilot in exchange for free Pro tier for life. Target: 20 intakes/week × 12 weeks = ~240 additional cases.
4. **Public datasets (bootstrapping).** NHTSA VOQ database (~1M+ consumer complaints with confirmed defect investigations), NHTSA Technical Service Bulletins, CarComplaints.com. Weaker signal than shop data but available immediately, at scale, at zero cost.
5. **Product usage (compounding).** Every Greenlit intake through the live product, with mechanic outcome rating attached, is a labeled training example. This is the long-term moat — no competitor without market presence can accumulate this data.

**Volume targets:**
- Phase 1 (retrieval-augmented, rules-based): 200–500 confirmed cases sufficient
- Phase 2 (first fine-tune): 2,000+ annotated conversation traces
- Phase 3 (production fine-tune): 10,000+ from product usage + shop partners

### Interviewer training data

Substantially easier data problem. Needs pairs of (structured question intent) → (plain-language rephrasing). Achievable via:
- Synthetic augmentation (LLM-rewrite of canonical questions)
- Forum scraping (Reddit r/MechanicAdvice — thousands of examples of how real drivers describe problems)
- Internal iteration once product is in real customer hands

Target: 2,000–5,000 pairs. Achievable in weeks with a labeling contractor.

---

## Sequencing: what gets built when

**Immediate (v2, current — already shipped in web MVP):**
- Two-model conversational loop with Interviewer + Diagnostician
- Both models run on general-purpose foundation LLMs (no fine-tune yet)
- Rules layer for UI selection (deterministic mapping)
- Stub mode for demos without API keys
- Vehicle context capture (year/make/model/mileage) as required first step

**Near-term (3–6 months):**
- Rules-based + retrieval-augmented Diagnostician: embed NHTSA VOQ + TSB corpus, retrieve top-K similar cases per intake as additional context
- Cofounder-led shop shadowing data collection
- Charlottesville partner shop pilot begins
- Mechanic outcome-rating flow live and generating labels

**Medium-term (6–12 months):**
- First fine-tune of Diagnostician on collected conversation traces
- Interviewer fine-tune (easier problem, quicker win)
- Latency optimization: streaming Diagnostician responses, precomputed likely next questions

**Long-term (12+ months):**
- Continuous fine-tune pipeline: quarterly retraining on accumulated outcome-labeled data
- Vehicle-class specialization (EV ontology, fleet-vehicle model, luxury vs. economy)
- OBD-II integration for shops: brief pre-populates diagnostic scanner starting points, saving 5–10 min per intake on newer vehicles

---

## Long-term positioning: ICE vs. EV vs. modern electronic vehicles

The concern that quieter, more electronic vehicles reduce Greenlit's utility deserves an explicit response.

**Data reality:** The average U.S. vehicle age is 12.6 years and rising. Half the cars on U.S. roads today will still be on the road in 2035. Greenlit's ICE-heavy diagnostic ontology remains directly relevant for the majority of the addressable market for at least a decade.

**Newer vehicles are not a threat — they are a stronger use case.** Modern OBD-II diagnostic reads on newer cars take 5–10 minutes per vehicle at a busy shop. A structured symptom brief that pre-populates the technician's diagnostic scanner with likely modules to query saves *more* time on newer cars, not less. The audio input becomes less useful; the structured symptom capture becomes more valuable.

**EVs expand the surface area.** Battery degradation, regen braking feel, motor whine, HVAC anomalies, charging behavior — customers describe these symptoms in vague language just like they do ICE problems. Greenlit's "translate vague customer language into structured symptom vector" job is if anything *more* valuable for EVs, where mechanics have less accumulated intuition about failure modes.

**Product evolution to address this:**
- v1–v2 (now): ICE-optimized ontology, audio-forward capture
- v3 (~2028): OBD-II passthrough integration for partner shops
- v4 (~2030+): EV-specific diagnostic ontology (regen feel, range anomalies, motor telemetry), Android Auto / CarPlay data ingestion where APIs permit

---

## Risks and mitigations (specific to AI system)

| Risk | Mitigation |
|------|-----------|
| Diagnostician hallucinates causes | Rules layer + retrieval anchors the model to a bounded ontology; disclaimer is triage aid, not diagnosis; mechanic's judgment always final |
| Interviewer asks a bad question that produces useless answer | Bounded question count (5–8 max), rules-layer UI constraints, fallback to natural-language input |
| Fine-tune data is contaminated with wrong labels | Cofounder-annotated data is gold-standard; product usage data is filtered through outcome-rating gate (only cases with confirmed mechanic outcome count as training signal) |
| Latency exceeds user tolerance | Batched Diagnostician firing (once per cycle, not per question), streaming responses, model-size-vs-quality tradeoff monitored per release |
| Foundation model provider changes pricing / access | Interviewer/Diagnostician are separately provider-swappable via Edge Function; not locked to any single vendor |

---

## Summary of changes vs. original business plan

- **"Fine-tuned model"** → **"Two-model architecture (Interviewer + Diagnostician) plus deterministic rules layer"**
- **"Training data from shops"** → **"Phased data strategy: public datasets → shop shadowing → cofounder annotation → product usage flywheel"**
- **"iOS-first delivery"** → **"Web-MVP-first (live), native iOS deferred but on roadmap for lock-screen shortcut only"**
- **"Universal diagnostic model"** → **"ICE-optimized v1–v2, OBD-II integration v3, EV specialization v4"**
- **"Fine-tune ASAP"** → **"Rules + retrieval for v1, fine-tune when 500+ labeled cases exist, not before"**

Everything else in the primary business plan (market sizing, GTM, pricing, cofounder structure, competitive positioning, liability disclaimers) remains as written.
