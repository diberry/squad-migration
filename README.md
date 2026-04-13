# Squad-Powered Code Migration Tool

A migration orchestration framework built on Squad SDK that parallelizes framework upgrades using specialized agents for analysis, transformation, testing, and rollback.

## Project Status

🚀 **MVP Phase 1** — Initial scaffolding with TDD implementation plan

## Quick Start

1. Review the TDD implementation plan in `PLAN.md`
2. Start with Phase 1 features (Config → State → Events)
3. Run tests: `npm test`
4. Build TypeScript: `npm run build`

## Architecture

See `PLAN.md` for the full architecture overview, SDK module mapping, and implementation phases.

## SDK Integration

This tool leverages the Squad SDK for:
- Agent orchestration via `builders.defineAgent()`
- Routing via `builders.defineRouting()`
- Event tracking via `runtime.EventBus`
- State persistence via `state.SquadState`
- Skill management via `skills.SkillRegistry`
- Hook enforcement via `hooks.HookPipeline`
- Platform integration via `platform.createPlatformAdapter()`
- Progress monitoring via `ralph.RalphMonitor`

## Development

- **Test-Driven Development**: Write tests first (see `PLAN.md`)
- **Phases**: Follow implementation phases in PLAN.md
- **Type Safety**: Full TypeScript strict mode

## Next Steps

1. Implement Phase 1: Configuration schema + State + Events
2. Build Analyzer agent for file discovery
3. Implement Migration Planner for batching
4. Add Transformer and Tester agents
5. Complete Orchestrator for full pipeline
