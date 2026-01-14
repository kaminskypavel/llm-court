## 📚 PRIORITY READING LIST FOR AGORA PROJECT

---

## 🔴 TIER 1: MUST READ (4 papers, 4 hours)

**Read these first. They're the complete foundation.**

| #   | Paper                                          | Authors                | Time   | Link                 | Why Critical                                          |
| --- | ---------------------------------------------- | ---------------------- | ------ | -------------------- | ----------------------------------------------------- |
| 1   | **Improving Factuality via Multiagent Debate** | Du et al. (2023)       | 45 min | arXiv:2305.14325     | Foundation—Society of Minds mechanism                 |
| 2   | **Minimizing Hallucinations via DIGRA**        | Yang et al. (2025)     | 60 min | MDPI:2076-3417       | Prevents hallucination propagation (Woozle effect)    |
| 3   | **Multi-LLM Debate Framework**                 | Estornell & Liu (2024) | 75 min | OpenReview Framework | Why judges fail; interventions that work              |
| 4   | **Judge Consensus Detection**                  | Hu et al. (2025)       | 60 min | arXiv:2510.12697     | Beta-Binomial judge convergence; no meta-judge needed |

---

## 🟡 TIER 2: SHOULD READ (6 papers, 5 hours)

**Read after Tier 1. Fills in design details and practical considerations.**

| #   | Paper                                 | Authors              | Time   | Link                |
| --- | ------------------------------------- | -------------------- | ------ | ------------------- |
| 5   | **Panel Size & Diversity Analysis**   | Zhao et al. (2025)   | 50 min | arXiv:2406.08598    |
| 6   | **DEBATE Benchmark Dataset**          | Chuang et al. (2025) | 40 min | arXiv:2510.25110    |
| 7   | **AI Safety via Debate** (theory)     | Irving et al. (2018) | 60 min | arXiv Safety Debate |
| 8   | **Encouraging Divergent Thinking**    | Liang et al. (2024)  | 35 min | arXiv:2305.19118    |
| 9   | **ReConcile: Round-Table Conference** | Various (2024)       | 35 min | arXiv:2404.18796    |
| 10  | **ChatEval: LLM Evaluation**          | Various (2023)       | 30 min | arXiv:2308.07201    |

---

## 🟢 TIER 3: NICE TO HAVE (5 papers, 3 hours)

**Implementation optimization and specific techniques.**

| #   | Paper                             | Authors            | Time   | Link             |
| --- | --------------------------------- | ------------------ | ------ | ---------------- |
| 11  | **S²-MAD: Efficient Debate**      | Various (2025)     | 35 min | arXiv:2502.04790 |
| 12  | **Combating Adversarial Attacks** | Chern & Fan (2024) | 40 min | arXiv:2401.05998 |
| 13  | **Khan et al. Truthfulness**      | Khan et al. (2024) | 35 min | Search arXiv     |
| 14  | **ReasonGraph Visualization**     | Li et al. (2025)   | 25 min | arXiv:2503.03979 |
| 15  | **AgentLens: Visual Analysis**    | Various (2024)     | 20 min | arXiv:2402.08995 |

---

## ⏱️ FASTEST PATH: 5 Hours (Just Tier 1 + Tier 2 highlights)

**Recommended if you want to start building immediately:**

1.  **Du et al. (2023)** - 45 min → Learn how debate works
2.  **Yang et al. (2025)** - 60 min → Learn DIGRA (prevent hallucinations)
3.  **Estornell & Liu (2024)** - 50 min → Skim interventions section
4.  **Hu et al. (2025)** - 45 min → Judge consensus mechanism
5.  **Zhao et al. (2025)** - 40 min → Optimal panel size

**Total: ~4 hours**

This is enough to implement Phase 1 of Agora.

---

## 🎯 KEY FACTS TO EXTRACT (Implement These)

## From Yang et al. (CRITICAL)

text

`DIGRA Algorithm: Agents only learn from high-IGR agents   IGR(A, B) = diversity[B] - correlation[A,B]  If IGR > threshold: A learns from B  If IGR < threshold: A ignores B Result: Hallucinations stay localized, don't spread Improvement: +5.8% accuracy, 62% fewer tokens`

## From Du et al. (CRITICAL)

text

`Society of Minds: 3-5 agents, 2-4 rounds optimal Echo Chamber: Identical models converge to wrong answer Solution: Use diverse models Improvement: +5-22% on various benchmarks Works with chain-of-thought orthogonally`

## From Hu et al. (CRITICAL)

text

`Judge Consensus: Use Beta-Binomial mixture model Convergence Detection: KS-test on opinion distribution Result: No meta-judge needed; panel self-corrects Improvement: +7-9% accuracy vs. majority voting Resilience: Large panels survive bad judges`

## From Estornell & Liu (CRITICAL)

text

`Three Problems: 1. Tyranny of Majority (Theorem 5.1) 2. Shared Misconceptions (Theorem 5.4) 3. Information Diversity Collapse (Theorem 5.2) Three Solutions: 1. Diversity Pruning (KL divergence-based) 2. Quality Pruning (task relevance) 3. Misconception Refutation (auto-identify false claims) Combined: +6-11% improvement`

---

## 📊 PAPERS BY IMPLEMENTATION COMPONENT

**Debate Agents**: Du et al., Yang et al., Liang et al.  
**Judge Panels**: Hu et al., Zhao et al., ReConcile  
**Hallucination Safety**: Yang et al., Estornell & Liu, Khan et al.  
**Benchmarking**: Chuang et al. (DEBATE), ChatEval  
**Visualization**: ReasonGraph, AgentLens  
**Efficiency**: S²-MAD

---

## ✅ COMPLETE READING CHECKLIST

## Must Do (4 hours)

- Du et al. (2023)

- Yang et al. (2025)

- Estornell & Liu (2024)

- Hu et al. (2025)

## Should Do (5 hours)

- Zhao et al. (2025)

- Chuang et al. (2025)

- Irving et al. (2018)

- Liang et al. (2024)

- ReConcile & ChatEval

## Can Skip Initially

- S²-MAD (for later optimization)
- AgentLens (reference only)
- ReasonGraph (check if you like the viz approach)

---

## 📎 ALL LINKS IN ONE PLACE

**Tier 1 (Must Read)**:

- Du et al.: [https://arxiv.org/pdf/2305.14325.pdf](https://arxiv.org/pdf/2305.14325.pdf)
- Yang et al.: [https://www.mdpi.com/2076-3417/15/7/3676](https://www.mdpi.com/2076-3417/15/7/3676)
- Estornell & Liu: [https://openreview.net/pdf?id=sy7eSEXdPC](https://openreview.net/pdf?id=sy7eSEXdPC)
- Hu et al.: [https://arxiv.org/abs/2510.12697](https://arxiv.org/abs/2510.12697)

**Tier 2 (Should Read)**:

- Zhao et al.: [https://arxiv.org/pdf/2406.08598.pdf](https://arxiv.org/pdf/2406.08598.pdf)
- Chuang et al.: [https://arxiv.org/abs/2510.25110](https://arxiv.org/abs/2510.25110)
- Irving et al.: Search arXiv "AI Safety via Debate"
- Liang et al.: [https://arxiv.org/pdf/2305.19118.pdf](https://arxiv.org/pdf/2305.19118.pdf)
- ReConcile: [https://arxiv.org/pdf/2404.18796.pdf](https://arxiv.org/pdf/2404.18796.pdf)
- ChatEval: [https://arxiv.org/pdf/2308.07201.pdf](https://arxiv.org/pdf/2308.07201.pdf)

**Tier 3 (Nice to Have)**:

- S²-MAD: [http://arxiv.org/pdf/2502.04790.pdf](http://arxiv.org/pdf/2502.04790.pdf)
- ReasonGraph: [https://arxiv.org/html/2503.03979v1](https://arxiv.org/html/2503.03979v1)
- AgentLens: [https://arxiv.org/html/2402.08995](https://arxiv.org/html/2402.08995)

---

I've saved a **454-line complete reading guide** (`papers_reading_list.md`) with:

- ✅ All papers ranked by priority
- ✅ Direct links to PDF/arXiv
- ✅ Key takeaways per paper
- ✅ Suggested reading schedule (20 hours total)
- ✅ Fast-track option (5 hours)
- ✅ What to extract from each paper
- ✅ Completion checklist
