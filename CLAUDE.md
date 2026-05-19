# CLAUDE.md



## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health

## Obsidian CLI使用规范
- 操作Obsidioan时，优先通过obsidian-cli skill 调用命令。
- 所有命令默认加上 'silent'，除非我特别说要在前台打开。
- 标签搜索优先使用obsidian tag命令，比全文搜索更精确。


## 工作流程规范

1. **需求对齐**：在正式开始任务之前，通过中文进行多轮提问确保与用户对齐需求，并生成项目文件夹并创建需求文档plan.md文件，之后将每次需求变更都记录下来。
2. **项目实施**：项目实施阶段，自动生成开发文档readme.md。
3. **规范创建**：每次项目开发过程都需要创建规范standard.md文档，之后执行plan.md中计划去写代码的时候，需要参考standard.md文件中提到的规范。
4. **对话记录**：每次结束项目之后，把我们之间的对话内容包含所有技术细节、代码更改的部分都记录在talk.md文件中。
5. **项目总结**：每次结束项目之后，生成项目总结文档summary.md，总结项目中的关键点，包括技术细节、需求细节、开发细节、项目总结等。
6. **持续改进**：在每次项目结束后，分析项目中的不足之处，并在plan.md中记录改进计划，以便在未来的项目中进行优化。
7. **项目管理**：在每次项目结束后，根据改进计划，更新项目管理文档plan.md，standard.md，summary.md，talk.md等。
8. **代码审查**：在每次项目结束后，进行代码审查，确保代码质量，并记录在review.md文件中。
9. **文档编写**：在每次项目内容发生更新后，更新项目文档，包括需求文档、开发文档、规范文档、项目总结文档、对话记录文档等，并记录在document.md文件中。
10. **github管理**：在每次项目有新的更新之后，和我确认之后，及时更新github仓库，确保代码同步。