# Product Requirements Document (PRD): ProcediPriz

## 1. Executive Summary

ProcediPriz is a deterministic, high-speed calculation platform designed specifically for neurosurgeons.

It solves the friction of reconciling the SBN (*Sociedade Brasileira de Neurocirurgia*) specialty catalog with the CBHPM (*Classificação Brasileira Hierarquizada de Procedimentos Médicos*) pricing guidelines.

---

## 2. Target Audience & DX/UX

### Audience

- Neurosurgeons
- Immediate administrative assistants

### Environment

- Clinical offices
- Hospitals
- Potentially with third parties present

### UX Core Value

Absolute:

- Privacy
- Speed
- Zero cognitive load

---

## 3. Product Features & User Flow

### 3.1 Privacy-First Landing Screen (The "Curtain")

To protect physician privacy when opening the application in front of patients or staff, the initial interface must be completely sterile regarding financial data.

#### UI

A minimalist:

- Terminal-like interface, or
- Search-engine-like interface

#### Interaction

A central search bar with autocomplete functionality.

#### Placeholder

```text
Pesquisar procedimento ou código SBN/CBHPM...
```

#### Action

Selecting a procedure from the dropdown navigates the user to the calculation interface.

---

### 3.2 Calculation Engine (Business Rules)

The platform must calculate fees with absolute mathematical precision based on the selected procedure's porte (base value).

#### Fee Distribution Matrix

##### Cirurgião Principal

Receives:

- 100% of the financial value corresponding to the selected porte.

##### 1º Auxiliar

Receives:

- 30% of the Cirurgião Principal's total value.

##### 2º, 3º e 4º Auxiliares

Each receives:

- 20% of the Cirurgião Principal's total value.
- Calculation must be performed individually per assistant.

##### Anestesiologista (Optional)

When the **Necessidade de Anestesia** toggle/flag is activated:

- Add 100% of the anesthesia porte value.

---

## 4. Non-Functional Requirements

### Spec-Driven Design (SDD)

The API contract (`openapi.yaml`) is the single source of truth.

### Branding

The application UI must maintain a:

- Sophisticated aesthetic
- Technology-forward visual identity

### Mandatory Footer

The bottom of the UI must contain, discreetly:

- 2026
- LabF5
- Todos os direitos reservados

No other development studio mentions are permitted.

### Responsiveness

The application must function flawlessly on:

- Desktop monitors
- Mobile devices

---

## 5. Linguistics

### UI Context

Portuguese (PT-BR)

### Code Context

English