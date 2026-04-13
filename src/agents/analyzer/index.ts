import * as fs from 'node:fs';
import * as path from 'node:path';
import type { MigrationConfig } from '../../types/config';
import type { MigrationAnalysis } from '../../types/migration';

export class AnalyzerAgent {
  constructor(private config: MigrationConfig) {}

  async analyze(codebasePath: string): Promise<MigrationAnalysis> {
    const files = await this.getFileInventory(codebasePath);
    const dependencies = await this.buildDependencyGraph(codebasePath);
    const complexityBreakdown = { easy: 0, medium: 0, hard: 0 };
    for (const file of files) {
      const c = this.estimateComplexity(path.join(codebasePath, file));
      complexityBreakdown[c]++;
    }
    return { filesCount: files.length, complexityBreakdown, dependencies };
  }

  async getFileInventory(codebasePath: string): Promise<string[]> {
    const pattern = this.config.source.pattern;
    const files: string[] = [];
    await this.walkDir(codebasePath, codebasePath, pattern, files);
    return files.sort();
  }

  async buildDependencyGraph(codebasePath: string): Promise<Map<string, string[]>> {
    const files = await this.getFileInventory(codebasePath);
    const graph = new Map<string, string[]>();
    for (const file of files) {
      const fullPath = path.join(codebasePath, file);
      const deps = this.extractImports(fullPath, codebasePath);
      graph.set(file, deps.filter(d => files.includes(d)));
    }
    return graph;
  }

  estimateComplexity(filePath: string): 'easy' | 'medium' | 'hard' {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').length;
      const importCount = (content.match(/(?:import|require)\s*\(/g) || []).length +
                          (content.match(/^import\s/gm) || []).length;
      if (lines > 300 || importCount > 15) return 'hard';
      if (lines > 100 || importCount > 5) return 'medium';
      return 'easy';
    } catch {
      return 'medium';
    }
  }

  private extractImports(filePath: string, codebasePath: string): string[] {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const deps: string[] = [];
      const importRegex = /(?:import\s+.*?from\s+['"](.+?)['"]|require\s*\(\s*['"](.+?)['"]\s*\))/g;
      let match: RegExpExecArray | null;
      while ((match = importRegex.exec(content)) !== null) {
        const specifier = match[1] || match[2];
        if (specifier.startsWith('.')) {
          const dir = path.dirname(filePath);
          let resolved = path.resolve(dir, specifier);
          // Try common extensions
          for (const ext of ['', '.ts', '.js', '.tsx', '.jsx']) {
            const candidate = resolved + ext;
            if (fs.existsSync(candidate)) {
              resolved = candidate;
              break;
            }
          }
          const rel = path.relative(codebasePath, resolved).replace(/\\/g, '/');
          deps.push(rel);
        }
      }
      return deps;
    } catch {
      return [];
    }
  }

  private async walkDir(root: string, dir: string, pattern: string, results: string[]): Promise<void> {
    const ext = this.getExtFromPattern(pattern);
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        await this.walkDir(root, fullPath, pattern, results);
      } else if (entry.isFile()) {
        if (ext && !entry.name.endsWith(ext)) continue;
        const rel = path.relative(root, fullPath).replace(/\\/g, '/');
        results.push(rel);
      }
    }
  }

  private getExtFromPattern(pattern: string): string | null {
    const match = pattern.match(/\*(\.\w+)$/);
    return match ? match[1] : null;
  }
}
