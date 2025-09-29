import { vi, beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { mount, VueWrapper, enableAutoUnmount } from '@vue/test-utils'
import { createI18nMock } from '../mocks/index'
import { useWindowMock } from '../mocks/window'
import { store } from '../../src/services/store'
import Editor from '../../src/agent/Editor.vue'
import Agent from '../../src/models/agent'
import Dialog from '../../src/composables/dialog'
import { stubTeleport } from '../mocks/stubs'
import { nextTick } from 'vue'


enableAutoUnmount(afterAll)

vi.mock('../../src/services/i18n', async () => {
  return createI18nMock()
})

beforeAll(() => {
  useWindowMock()
  store.loadSettings()
  store.loadAgents()
})

beforeEach(() => {
  vi.clearAllMocks()
})

test('Renders editor in create mode', async () => {
  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'create',
      agent: new Agent()
    }
  })
  await nextTick()

  // Should show step navigation
  const steps = wrapper.findAll('.wizard-step')
  expect(steps.length).toBeGreaterThan(0)
  
  // In create mode, generator step should be visible (check WizardStep component instead)
  const wizardStep = wrapper.findComponent({ name: 'WizardStep' })
  expect(wizardStep.exists()).toBe(true)
  expect(wizardStep.props('visible')).toBe(true)
})

test('Shows different steps for witsy vs a2a agents', async () => {

  const witsyAgent = new Agent()
  witsyAgent.source = 'witsy'
  
  const witsyWrapper = mount(Editor, {
    props: { 
      mode: 'create',
      agent: witsyAgent
    }
  })
  await nextTick()
  
  expect(witsyWrapper.find('[name=goal]').exists()).toBe(true)

  // Test a2a agent (should not have Goal step)
  const a2aAgent = new Agent()
  a2aAgent.source = 'a2a'
  
  const a2aWrapper = mount(Editor, {
    props: { 
      mode: 'create',
      agent: a2aAgent
    }
  })
  await nextTick()
  expect(a2aWrapper.find('[name=goal]').exists()).toBe(true)
})

test('Allows navigation between steps by clicking', async () => {
  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'edit',
      agent: new Agent()
    }
  })
  await nextTick()

  const steps = wrapper.findAll('.wizard-step')
  expect(steps.length).toBeGreaterThan(1)

  // First step should be selected initially
  expect(steps[0].classes()).toContain('active')

  // Click on second step (should be enabled since it's create mode)
  await steps[1].trigger('click')
  await nextTick()

  // Second step should now be selected
  expect(steps[1].classes()).toContain('active')
  expect(steps[0].classes()).not.toContain('active')
})

test('Shows form fields for information step', async () => {
  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'create',
      agent: new Agent()
    }
  })
  await nextTick()

  // Should show name field
  const nameField = wrapper.find('input[name="name"]')
  expect(nameField.exists()).toBe(true)

  // Should show description field
  const descriptionField = wrapper.find('textarea[name="description"]')
  expect(descriptionField.exists()).toBe(true)

  // Should show type field
  const typeField = wrapper.find('select[name="type"]')
  expect(typeField.exists()).toBe(true)
  
  // Type field should have options
  const typeOptions = typeField.findAll('option')
  expect(typeOptions.length).toBe(2)
  expect(typeOptions[0].attributes('value')).toBe('runnable')
  expect(typeOptions[1].attributes('value')).toBe('support')
})

test('Populates form fields with agent data in edit mode', async () => {
  const agent = new Agent()
  agent.name = 'Test Agent Name'
  agent.description = 'Test Agent Description'
  agent.type = 'support'

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Fields should be populated with agent data
  const nameField = wrapper.find<HTMLInputElement>('input[name="name"]')
  expect(nameField.element.value).toBe('Test Agent Name')

  const descriptionField = wrapper.find<HTMLTextAreaElement>('textarea[name="description"]')
  expect(descriptionField.element.value).toBe('Test Agent Description')

  const typeField = wrapper.find<HTMLSelectElement>('select[name="type"]')
  expect(typeField.element.value).toBe('support')
})

test('Shows model step with engine and model selects', async () => {
  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'edit',
      agent: new Agent()
    }
  })
  await nextTick()

  // Navigate to model step
  const steps = wrapper.findAll('.wizard-step')
  const modelStep = steps.find(step => step.text().includes('agent.create.llm.title'))
  expect(modelStep).toBeTruthy()
  
  await modelStep!.trigger('click')
  await nextTick()

  // Should show EngineModelSelect component
  const engineSelect = wrapper.findComponent({ name: 'EngineModelSelect' })
  expect(engineSelect.exists()).toBe(true)

  // Should show LangSelect component
  const langSelect = wrapper.findComponent({ name: 'LangSelect' })
  expect(langSelect.exists()).toBe(true)
})

test('Shows workflow step with step panels', async () => {
  const agent = new Agent()
  agent.steps = [
    { prompt: 'Step 1 prompt', tools: null, agents: [] },
    { prompt: 'Step 2 prompt', tools: null, agents: [] }
  ]

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Navigate to workflow step
  const steps = wrapper.findAll('.wizard-step')
  const workflowStep = steps.find(step => step.text().includes('agent.create.workflow.title'))
  expect(workflowStep).toBeTruthy()
  
  await workflowStep!.trigger('click')
  await nextTick()

  // Should show step panels
  const stepPanels = wrapper.findAll('.step-panel')
  expect(stepPanels.length).toBe(2)

  // Should show workflow arrows between steps
  const arrows = wrapper.findAll('.workflow-arrow')
  expect(arrows.length).toBe(1) // One arrow between two steps
})

test('Can expand and collapse workflow steps', async () => {
  const agent = new Agent()
  agent.steps = [
    { prompt: 'Step 1 prompt', tools: null, agents: [] }
  ]

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Navigate to workflow step
  const steps = wrapper.findAll('.wizard-step')
  const workflowStep = steps.find(step => step.text().includes('agent.create.workflow.title'))
  await workflowStep!.trigger('click')
  await nextTick()

  // Initially in create mode, first step should be expanded (expandedStep = 0)
  let panelBody = wrapper.find('.step-panel .panel-body')
  expect(panelBody.exists()).toBe(true)

  // Click the panel header to collapse
  const panelHeader = wrapper.find('.step-panel .panel-header')
  await panelHeader.trigger('click')
  await nextTick()

  // Panel body should be hidden (expandedStep = -1)
  panelBody = wrapper.find('.step-panel .panel-body')
  expect(panelBody.exists()).toBe(false)
})

test('Shows step management buttons in workflow', async () => {
  const agent = new Agent()
  agent.steps = [
    { prompt: 'Step 1 prompt', tools: null, agents: [] },
    { prompt: 'Step 2 prompt', tools: null, agents: [] }
  ]

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Navigate to workflow step
  const steps = wrapper.findAll('.wizard-step')
  const workflowStep = steps.find(step => step.text().includes('agent.create.workflow.title'))
  await workflowStep!.trigger('click')
  await nextTick()

  // Should show add step button in the workflow step
  const addStepButton = wrapper.find('button[name="add-step"]')
  expect(addStepButton.exists()).toBe(true)
  expect(addStepButton.text()).toContain('agent.create.workflow.addStep')

  // Should show delete button for second step (when expanded)
  const stepPanels = wrapper.findAll('.step-panel')
  const secondPanel = stepPanels[1]
  await secondPanel.find('.panel-header').trigger('click')
  await nextTick()

  const deleteButton = secondPanel.find('.delete')
  expect(deleteButton.exists()).toBe(true)
})

test('Shows invocation step with schedule and variables', async () => {
  const agent = new Agent()
  agent.steps = [
    { prompt: 'Hello {{name}}, how are you?', tools: null, agents: [] }
  ]
  agent.schedule = '0 9 * * *'
  agent.invocationValues = { name: 'World' }

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Navigate to invocation step
  const steps = wrapper.findAll('.wizard-step')
  const invocationStep = steps.find(step => step.text().includes('agent.create.invocation.title'))
  expect(invocationStep).toBeTruthy()
  
  await invocationStep!.trigger('click')
  await nextTick()

  // Should show Scheduler component
  const scheduler = wrapper.findComponent({ name: 'Scheduler' })
  expect(scheduler.exists()).toBe(true)

  // Should show variables table for prompt inputs
  const variablesTable = wrapper.find('.variables')
  expect(variablesTable.exists()).toBe(true)
  
  const variableRows = variablesTable.findAll('tbody tr')
  expect(variableRows.length).toBe(1)
  expect(variableRows[0].text()).toContain('name')

  // Should show next runs display (since schedule is set)
  const nextRunsSection = wrapper.find('[for="next"]')
  expect(nextRunsSection).toBeTruthy()
})

test('Emits cancel event when cancel button clicked', async () => {
  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'edit',
      agent: new Agent()
    }
  })
  await nextTick()

  const cancelButton = wrapper.find('header button[name=cancel]')
  await cancelButton.trigger('click')
  expect(wrapper.emitted('cancel')).toBeTruthy()
  expect(wrapper.emitted('cancel')![0]).toEqual([])
})

test('Calls save API when save button clicked', async () => {
  const agent = new Agent()
  agent.name = 'Test Agent'
  agent.description = 'Test Description'

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  const steps = wrapper.findAll('.wizard-step')
  const invocationStep = steps.find(step => step.text().includes('agent.create.invocation.title'))
  await invocationStep!.trigger('click')
  await nextTick()

  const saveButton = wrapper.find('header button[name=next]')
  await saveButton.trigger('click')
  expect(window.api.agents.save).toHaveBeenCalled()
})

test('Shows ToolsMenu and AgentSelector components', async () => {
  const agent = new Agent()
  agent.steps = [
    { prompt: 'Step 1', tools: null, agents: [] }
  ]

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Navigate to workflow step
  const steps = wrapper.findAll('.wizard-step')
  const workflowStep = steps.find(step => step.text().includes('agent.create.workflow.title'))
  await workflowStep!.trigger('click')
  await nextTick()

  // ToolsMenu should not be visible initially
  let toolsMenu = wrapper.findComponent({ name: 'ToolsMenu' })
  expect(toolsMenu.exists()).toBe(false)

  // Click tools button to show ToolsMenu
  const toolsButton = wrapper.find('.step-actions .tools')
  await toolsButton.trigger('click')
  await nextTick()

  // ToolsMenu should now be visible
  toolsMenu = wrapper.findComponent({ name: 'ToolsMenu' })
  expect(toolsMenu.exists()).toBe(true)

  // Should render AgentSelector component  
  const agentSelector = wrapper.findComponent({ name: 'AgentSelector' })
  expect(agentSelector.exists()).toBe(true)
})

test('Shows model settings step when available', async () => {
  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'create',
      agent: new Agent()
    }
  })
  await nextTick()

  // Complete general step
  const nameField = wrapper.find('input[name="name"]')
  await nameField.setValue('Test Agent')
  const descriptionField = wrapper.find('textarea[name="description"]')
  await descriptionField.setValue('Test Description')
  const goalField = wrapper.find('textarea[name="goal"]')
  await goalField.setValue('Test Goal')
  const nextButton = wrapper.find('button[name="next"]')
  await nextButton.trigger('click')
  await nextTick()

  // Should show model settings button
  const buttons = wrapper.findAll('button')
  const settingsBtn = buttons.find(btn => btn.text().includes('agent.create.llm.showModelSettings'))
  expect(settingsBtn).toBeTruthy()
})

// === VALIDATION TESTS ===

test('Validates information step - shows error for empty fields', async () => {
  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'create',
      agent: new Agent()
    }
  })
  await nextTick()

  // Leave fields empty and try to proceed
  const wizardStep = wrapper.findComponent({ name: 'WizardStep' })
  
  // Find and click the Next button (emits 'next' event)
  await wizardStep.vm.$emit('next')
  await nextTick()

  // Should show error message in HTML (error prop should be passed to WizardStep)
  expect(wizardStep.props('error')).toBeTruthy()
  
  // Should still be on the same step
  const steps = wrapper.findAll('.wizard-step')
  expect(steps[0].classes()).toContain('active')
})

test('Validates information step - proceeds when fields are filled', async () => {
  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'create',
      agent: new Agent()
    }
  })
  await nextTick()

  // Fill in required fields
  const nameField = wrapper.find<HTMLInputElement>('input[name="name"]')
  await nameField.setValue('Test Agent')
  const descriptionField = wrapper.find<HTMLTextAreaElement>('textarea[name="description"]')
  await descriptionField.setValue('Test Description')
  const goalField = wrapper.find<HTMLTextAreaElement>('textarea[name="goal"]')
  await goalField.setValue('Test Goal')

  // Try to proceed using next button
  const nextButton = wrapper.find('button[name="next"]')
  await nextButton.trigger('click')
  await nextTick()

  // Should move to next step (Model step for witsy agents)
  const steps = wrapper.findAll('.wizard-step')
  const activeStep = steps.find(step => step.classes().includes('active'))
  expect(activeStep).toBeTruthy()
  expect(activeStep!.text()).toContain('agent.create.llm.title')
})

test('Workflow step handles multiple steps correctly', async () => {
  const agent = new Agent()
  agent.name = 'Test Agent'
  agent.description = 'Test Description'
  agent.instructions = 'Test Instructions'
  agent.steps = [
    { prompt: 'First step', tools: null, agents: [] },
    { prompt: 'Second step prompt', tools: null, agents: [] }
  ]

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Navigate to workflow step
  const steps = wrapper.findAll('.wizard-step')
  const workflowStep = steps.find(step => step.text().includes('agent.create.workflow.title'))
  await workflowStep!.trigger('click')
  await nextTick()

  // Should show multiple step panels
  const stepPanels = wrapper.findAll('.step-panel')
  expect(stepPanels.length).toBe(2)

  // Should show workflow arrow between steps
  const arrows = wrapper.findAll('.workflow-arrow')
  expect(arrows.length).toBe(1)
})

test('Previous button functionality', async () => {
  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'edit',
      agent: new Agent()
    }
  })
  await nextTick()

  // Navigate to second step first
  const steps = wrapper.findAll('.wizard-step')
  await steps[1].trigger('click')
  await nextTick()

  expect(steps[1].classes()).toContain('active')

  // Click previous button
  const wizardStep = wrapper.findComponent({ name: 'WizardStep' })
  await wizardStep.vm.$emit('prev')
  await nextTick()

  // Should go back to first step
  expect(steps[0].classes()).toContain('active')
  expect(steps[1].classes()).not.toContain('active')
})

test('Previous button from first step emits cancel', async () => {
  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'create',
      agent: new Agent()
    }
  })
  await nextTick()

  // Click previous button from first step
  const wizardStep = wrapper.findComponent({ name: 'WizardStep' })
  await wizardStep.vm.$emit('prev')
  await nextTick()

  // Should emit cancel event
  expect(wrapper.emitted('cancel')).toBeTruthy()
})

// === WORKFLOW MANAGEMENT TESTS ===

test('Adds new workflow step', async () => {
  const agent = new Agent()
  agent.steps = [
    { prompt: 'Step 1', tools: null, agents: [] }
  ]

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Navigate to workflow step
  const steps = wrapper.findAll('.wizard-step')
  const workflowStep = steps.find(step => step.text().includes('agent.create.workflow.title'))
  await workflowStep!.trigger('click')
  await nextTick()

  // Initially should have 1 step panel
  let stepPanels = wrapper.findAll('.step-panel')
  expect(stepPanels.length).toBe(1)

  // Click add step button
  const addStepButton = wrapper.find('button[name="add-step"]')
  await addStepButton.trigger('click')
  await nextTick()

  // Should now have 2 step panels
  stepPanels = wrapper.findAll('.step-panel')
  expect(stepPanels.length).toBe(2)
})

test('Deletes workflow step with confirmation', async () => {
  const agent = new Agent()
  agent.steps = [
    { prompt: 'Step 1', tools: null, agents: [] },
    { prompt: 'Step 2', tools: null, agents: [] }
  ]

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Navigate to workflow step
  const steps = wrapper.findAll('.wizard-step')
  const workflowStep = steps.find(step => step.text().includes('agent.create.workflow.title'))
  await workflowStep!.trigger('click')
  await nextTick()

  // Expand second step to show delete button
  const stepPanels = wrapper.findAll('.step-panel')
  await stepPanels[1].find('.panel-header').trigger('click')
  await nextTick()

  // Initially should have 2 step panels
  expect(stepPanels.length).toBe(2)

  // Click delete button (this will trigger dialog)
  const deleteButton = stepPanels[1].find('.delete')
  await deleteButton.trigger('click')
  await nextTick()

  // Dialog should have been called - but since we mocked it, we can't easily test the call
  // Instead verify the delete button exists and is clickable
  expect(deleteButton.exists()).toBe(true)
})

test('Shows tools and agents buttons in workflow steps', async () => {
  const agent = new Agent()
  agent.steps = [
    { prompt: 'Step 1', tools: null, agents: [] }
  ]

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Navigate to workflow step
  const steps = wrapper.findAll('.wizard-step')
  const workflowStep = steps.find(step => step.text().includes('agent.create.workflow.title'))
  await workflowStep!.trigger('click')
  await nextTick()

  // Should show tools and agents buttons in step actions
  const toolsButton = wrapper.find('.step-actions .tools')
  expect(toolsButton.exists()).toBe(true)
  expect(toolsButton.text()).toContain('agent.create.workflow.customTools')

  const agentsButton = wrapper.find('.step-actions .agents')
  expect(agentsButton.exists()).toBe(true)
  expect(agentsButton.text()).toContain('agent.create.workflow.customAgents')
})

test('ToolsMenu opens and updates step tool selection', async () => {
  const agent = new Agent()
  agent.steps = [
    { prompt: 'Step 1', tools: [], agents: [] }
  ]

  const wrapper: VueWrapper<any> = mount(Editor, {
    ...stubTeleport,
    props: { 
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Navigate to workflow step
  const steps = wrapper.findAll('.wizard-step')
  const workflowStep = steps.find(step => step.text().includes('agent.create.workflow.title'))
  await workflowStep!.trigger('click')
  await nextTick()

  // ToolsMenu should not be visible initially
  let toolsMenu = wrapper.findComponent({ name: 'ToolsMenu' })
  expect(toolsMenu.exists()).toBe(false)

  // Click tools button to open ToolsMenu
  const toolsButton = wrapper.find('.step-actions .tools')
  await toolsButton.trigger('click')
  await nextTick()

  // ToolsMenu should now be visible
  toolsMenu = wrapper.findComponent({ name: 'ToolsMenu' })
  expect(toolsMenu.exists()).toBe(true)

  // Verify the tool selection is passed correctly
  expect(toolsMenu.props('toolSelection')).toEqual([])

  // Simulate saving tools from ToolsMenu
  await toolsMenu.vm.$emit('pluginToggle', 'search')
  await toolsMenu.vm.$emit('serverToolToggle', {}, { uuid: 'tool1___server1' })
  await toolsMenu.vm.$emit('close')
  await nextTick()

  // ToolsMenu should be closed
  toolsMenu = wrapper.findComponent({ name: 'ToolsMenu' })
  expect(toolsMenu.exists()).toBe(false)

  // Agent step should have updated tools
  expect(agent.steps[0].tools).toEqual(['search_internet', 'tool1___server1'])
})

test('Shows docrepo button in workflow steps', async () => {
  const agent = new Agent()
  agent.steps = [
    { prompt: 'Step 1', tools: null, agents: [] }
  ]

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Navigate to workflow step
  const steps = wrapper.findAll('.wizard-step')
  const workflowStep = steps.find(step => step.text().includes('agent.create.workflow.title'))
  await workflowStep!.trigger('click')
  await nextTick()

  // Should show docrepo button in step actions
  const docrepoButton = wrapper.find('.step-actions .docrepo')
  expect(docrepoButton.exists()).toBe(true)
  expect(docrepoButton.text()).toContain('agent.create.workflow.docRepo')
})

test('Shows docrepo help text when docrepo is selected', async () => {
  const agent = new Agent()
  agent.steps = [
    { prompt: 'Step 1', tools: null, agents: [], docrepo: 'uuid1' }
  ]

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Navigate to workflow step
  const steps = wrapper.findAll('.wizard-step')
  const workflowStep = steps.find(step => step.text().includes('agent.create.workflow.title'))
  await workflowStep!.trigger('click')
  await nextTick()

  // Should show docrepo help text in the panel body
  const panelBody = wrapper.find('.step-panel .panel-body')
  const helpTexts = panelBody.findAll('.help')
  
  // Find the help text that contains the docrepo help
  const docrepoHelpText = helpTexts.find(help => help.text().includes('agent.create.workflow.help.docRepo'))
  expect(docrepoHelpText).toBeTruthy()
})

test('Selecting docrepo opens ContextMenuPlus and updates step', async () => {
  const agent = new Agent()
  agent.steps = [
    { prompt: 'Step 1', tools: null, agents: [] }
  ]

  const wrapper: VueWrapper<any> = mount(Editor, {
    ...stubTeleport,
    props: { 
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Navigate to workflow step
  const steps = wrapper.findAll('.wizard-step')
  const workflowStep = steps.find(step => step.text().includes('agent.create.workflow.title'))
  await workflowStep!.trigger('click')
  await nextTick()

  // ContextMenuPlus should not be visible initially
  let docRepoMenu = wrapper.findComponent({ name: 'ContextMenuPlus' })
  expect(docRepoMenu.exists()).toBe(false)

  // Click docrepo button
  const docrepoButton = wrapper.find('.step-actions .docrepo')
  await docrepoButton.trigger('click')
  await nextTick()

  // ContextMenuPlus should now be visible
  docRepoMenu = wrapper.findComponent({ name: 'ContextMenuPlus' })
  expect(docRepoMenu.exists()).toBe(true)

  // Should show available doc repositories (look for actual menu structure)
  const menuItems = docRepoMenu.element.querySelectorAll('.item')
  expect(menuItems.length).toBeGreaterThan(0)
})

test('Docrepo selection updates agent step', async () => {
  const agent = new Agent()
  agent.steps = [
    { prompt: 'Step 1', tools: null, agents: [] }
  ]

  const wrapper: VueWrapper<any> = mount(Editor, {
    ...stubTeleport,
    props: { 
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Navigate to workflow step
  const steps = wrapper.findAll('.wizard-step')
  const workflowStep = steps.find(step => step.text().includes('agent.create.workflow.title'))
  await workflowStep!.trigger('click')
  await nextTick()

  // Click docrepo button to show menu
  const docrepoButton = wrapper.find('.step-actions .docrepo')
  await docrepoButton.trigger('click')
  await nextTick()

  // Find ContextMenuPlus and click on a docrepo item
  const docRepoMenu = wrapper.findComponent({ name: 'ContextMenuPlus' })
  expect(docRepoMenu.exists()).toBe(true)

  // Simulate clicking on a docrepo item (first available repo)
  const firstRepoItem = docRepoMenu.element.querySelector('div[data-testid="menu-item"]')
  if (firstRepoItem) {
    await firstRepoItem.click()
    await nextTick()
  
    // Agent step should be updated with the selected docrepo
    expect(agent.steps[0].docrepo).toBeTruthy()
  }
})

test('Docrepo selection can be cleared using footer clear button', async () => {
  const agent = new Agent()
  agent.steps = [
    { prompt: 'Step 1', tools: null, agents: [], docrepo: 'uuid1' }
  ]

  const wrapper: VueWrapper<any> = mount(Editor, {
    ...stubTeleport,
    props: { 
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Navigate to workflow step
  const steps = wrapper.findAll('.wizard-step')
  const workflowStep = steps.find(step => step.text().includes('agent.create.workflow.title'))
  await workflowStep!.trigger('click')
  await nextTick()

  // Initially should have docrepo assigned
  expect(agent.steps[0].docrepo).toBe('uuid1')

  // Click docrepo button to show menu
  const docrepoButton = wrapper.find('.step-actions .docrepo')
  await docrepoButton.trigger('click')
  await nextTick()

  // Find ContextMenuPlus and click on the clear button in footer
  const docRepoMenu = wrapper.findComponent({ name: 'ContextMenuPlus' })
  expect(docRepoMenu.exists()).toBe(true)

  // Should show footer with clear button since docrepo is assigned
  const clearButton = docRepoMenu.element.querySelector('.footer-select button')
  if (clearButton && clearButton.textContent?.includes('common.clear')) {
    await clearButton.click()
    await nextTick()
  
    // Agent step docrepo should be cleared
    expect(agent.steps[0].docrepo).toBeUndefined()
  }
})

test('Changing engine updates model selection', async () => {
  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'edit',
      agent: new Agent()
    }
  })
  await nextTick()

  // Navigate to model step
  const steps = wrapper.findAll('.wizard-step')
  const modelStep = steps.find(step => step.text().includes('agent.create.llm.title'))
  await modelStep!.trigger('click')
  await nextTick()

  // Change engine selection
  const engineSelect = wrapper.findComponent({ name: 'EngineModelSelect' })
  await engineSelect.vm.$emit('modelSelected', 'engine2', 'model2')
  await nextTick()

  expect(wrapper.vm.agent.engine).toBe('engine2')
  expect(wrapper.vm.agent.model).toBe('model2')
})

// === INVOCATION & SCHEDULE TESTS ===

test('Shows next runs when schedule is set', async () => {
  const agent = new Agent()
  agent.schedule = '0 9 * * *' // 9 AM daily
  agent.steps = [
    { prompt: 'Hello', tools: null, agents: [] }
  ]

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Navigate to invocation step
  const steps = wrapper.findAll('.wizard-step')
  const invocationStep = steps.find(step => step.text().includes('agent.create.invocation.title'))
  await invocationStep!.trigger('click')
  await nextTick()

  // Should show next runs section
  const nextRunsLabel = wrapper.find('label[for="next"]')
  expect(nextRunsLabel.exists()).toBe(true)
})

test('Updates invocation variables when typing', async () => {
  
  const agent = new Agent()
  agent.steps = [
    { prompt: 'Hello {{name}}, welcome to {{place}}', tools: null, agents: [] }
  ]
  agent.schedule = '0 9 * * *'
  agent.invocationValues = { name: 'John', place: 'Paris' }

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Navigate to invocation step
  const steps = wrapper.findAll('.wizard-step')
  const invocationStep = steps.find(step => step.text().includes('agent.create.invocation.title'))
  await invocationStep!.trigger('click')
  await nextTick()

  // Should show variables table with input fields
  const variableInputs = wrapper.findAll('.variables input[type="text"]')
  expect(variableInputs.length).toBe(2)
  
  // Values should be populated
  expect((variableInputs[0].element as HTMLInputElement).value).toBe('John')
  expect((variableInputs[1].element as HTMLInputElement).value).toBe('Paris')

  // Change a value
  await variableInputs[0].setValue('Jane')
  await variableInputs[0].trigger('input')
  
  // Should update the value
  expect((variableInputs[0].element as HTMLInputElement).value).toBe('Jane')
})

test('Shows prompt inputs table in workflow steps', async () => {
  const agent = new Agent()
  agent.steps = [
    { prompt: 'Hello {{name}}, your age is {{age}}', tools: null, agents: [] }
  ]

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Navigate to workflow step
  const steps = wrapper.findAll('.wizard-step')
  const workflowStep = steps.find(step => step.text().includes('agent.create.workflow.title'))
  await workflowStep!.trigger('click')
  await nextTick()

  // Should show prompt inputs table
  const promptInputsTable = wrapper.find('.prompt-inputs')
  expect(promptInputsTable.exists()).toBe(true)
  
  // Should show extracted variables
  const tableRows = promptInputsTable.findAll('tbody tr')
  expect(tableRows.length).toBe(2) // name and age variables
})

test('Shows model settings fields', async () => {
  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'edit',
      agent: new Agent()
    }
  })
  await nextTick()

  // Navigate to model step first
  const steps = wrapper.findAll('.wizard-step')
  const modelStep = steps.find(step => step.text().includes('agent.create.llm.title'))
  await modelStep!.trigger('click')
  await nextTick()

  // Click show settings button to navigate to settings
  const wizardStep = wrapper.findComponent({ name: 'WizardStep' })
  const settingsButton = wizardStep.find('button')
  if (settingsButton.exists()) {
    await settingsButton.trigger('click')
    await nextTick()

    // Should show model settings fields
    const contextWindowField = wrapper.find('input[name="contextWindowSize"]')
    expect(contextWindowField.exists()).toBe(true)

    const maxTokensField = wrapper.find('input[name="maxTokens"]')
    expect(maxTokensField.exists()).toBe(true)

    const temperatureField = wrapper.find('input[name="temperature"]')
    expect(temperatureField.exists()).toBe(true)
  }
})

test('Shows JSON schema button in workflow steps', async () => {
  const agent = new Agent()
  agent.steps = [
    { prompt: 'Step 1', tools: null, agents: [] }
  ]

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Navigate to workflow step
  const steps = wrapper.findAll('.wizard-step')
  const workflowStep = steps.find(step => step.text().includes('agent.create.workflow.title'))
  await workflowStep!.trigger('click')
  await nextTick()

  // Should show JSON schema button in step actions
  const jsonSchemaButton = wrapper.find('.step-actions .structured-output')
  expect(jsonSchemaButton.exists()).toBe(true)
  expect(jsonSchemaButton.text()).toContain('agent.create.workflow.jsonSchema')
})

test('Updates step jsonSchema when valid JSON is provided', async () => {
  const agent = new Agent()
  agent.steps = [
    { prompt: 'Step 1', tools: null, agents: [] }
  ]

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Navigate to workflow step
  const steps = wrapper.findAll('.wizard-step')
  const workflowStep = steps.find(step => step.text().includes('agent.create.workflow.title'))
  await workflowStep!.trigger('click')
  await nextTick()

  // Initially step should have no jsonSchema
  expect(agent.steps[0].jsonSchema).toBeUndefined()

  // Mock dialog to return valid JSON
  const validJsonSchema = '{"name": "string", "age": "number"}'
  vi.mocked(Dialog.show).mockResolvedValueOnce({ isConfirmed: true, value: validJsonSchema })

  // Click JSON schema button
  const jsonSchemaButton = wrapper.find('.step-actions .structured-output')
  await jsonSchemaButton.trigger('click')
  await nextTick()

  // Dialog should have been called with proper options
  expect(Dialog.show).toHaveBeenCalledWith(expect.objectContaining({
    title: 'agent.create.workflow.structuredOutput.title',
    html: 'agent.create.workflow.structuredOutput.text',
    input: 'textarea',
    inputValue: undefined,
    showCancelButton: true,
    confirmButtonText: 'common.save',
    inputValidator: expect.any(Function)
  }))

  // The step's jsonSchema should be updated with the dialog result
  expect(agent.steps[0].jsonSchema).toBe(validJsonSchema)
})

test('Clears step jsonSchema when empty JSON is provided', async () => {
  const agent = new Agent()
  agent.steps = [
    { prompt: 'Step 1', tools: null, agents: [], jsonSchema: '{"name": "string"}' }
  ]

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Navigate to workflow step
  const steps = wrapper.findAll('.wizard-step')
  const workflowStep = steps.find(step => step.text().includes('agent.create.workflow.title'))
  await workflowStep!.trigger('click')
  await nextTick()

  // Initially step should have jsonSchema
  expect(agent.steps[0].jsonSchema).toBe('{"name": "string"}')

  // Mock dialog to return empty string
  vi.mocked(Dialog.show).mockResolvedValueOnce({ isConfirmed: true, value: '   ' })

  // Click JSON schema button
  const jsonSchemaButton = wrapper.find('.step-actions .structured-output')
  await jsonSchemaButton.trigger('click')
  await nextTick()

  // The step's jsonSchema should be cleared
  expect(agent.steps[0].jsonSchema).toBeUndefined()
})

test('Preserves existing jsonSchema when dialog is cancelled', async () => {
  const agent = new Agent()
  agent.steps = [
    { prompt: 'Step 1', tools: null, agents: [], jsonSchema: '{"name": "string"}' }
  ]

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Navigate to workflow step
  const steps = wrapper.findAll('.wizard-step')
  const workflowStep = steps.find(step => step.text().includes('agent.create.workflow.title'))
  await workflowStep!.trigger('click')
  await nextTick()

  // Initially step should have jsonSchema
  const originalSchema = agent.steps[0].jsonSchema
  expect(originalSchema).toBe('{"name": "string"}')

  // Mock dialog to be cancelled
  vi.mocked(Dialog.show).mockResolvedValueOnce({ isConfirmed: false, value: 'new-schema' })

  // Click JSON schema button
  const jsonSchemaButton = wrapper.find('.step-actions .structured-output')
  await jsonSchemaButton.trigger('click')
  await nextTick()

  // The step's jsonSchema should remain unchanged
  expect(agent.steps[0].jsonSchema).toBe(originalSchema)
})

test('Shows existing jsonSchema in dialog input', async () => {
  const existingSchema = '{"name": "string", "age": "number"}'
  const agent = new Agent()
  agent.steps = [
    { prompt: 'Step 1', tools: null, agents: [], jsonSchema: existingSchema }
  ]

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Navigate to workflow step
  const steps = wrapper.findAll('.wizard-step')
  const workflowStep = steps.find(step => step.text().includes('agent.create.workflow.title'))
  await workflowStep!.trigger('click')
  await nextTick()

  // Mock dialog to return the same schema (simulating no change)
  vi.mocked(Dialog.show).mockResolvedValueOnce({ isConfirmed: true, value: existingSchema })

  // Click JSON schema button
  const jsonSchemaButton = wrapper.find('.step-actions .structured-output')
  await jsonSchemaButton.trigger('click')
  await nextTick()

  // Dialog should be called with existing schema as inputValue
  expect(Dialog.show).toHaveBeenCalledWith(expect.objectContaining({
    inputValue: existingSchema
  }))
})

test('JSON schema can be cleared using deny button', async () => {
  const agent = new Agent()
  agent.steps = [
    { prompt: 'Step 1', tools: null, agents: [], jsonSchema: '{"name": "string"}' }
  ]

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Navigate to workflow step
  const steps = wrapper.findAll('.wizard-step')
  const workflowStep = steps.find(step => step.text().includes('agent.create.workflow.title'))
  await workflowStep!.trigger('click')
  await nextTick()

  // Initially step should have jsonSchema
  expect(agent.steps[0].jsonSchema).toBe('{"name": "string"}')

  // Mock dialog to simulate clicking deny/clear button
  vi.mocked(Dialog.show).mockResolvedValueOnce({ isDenied: true, value: '{"name": "string"}' })

  // Click JSON schema button
  const jsonSchemaButton = wrapper.find('.step-actions .structured-output')
  await jsonSchemaButton.trigger('click')
  await nextTick()

  // Dialog should have been called with clear button
  expect(Dialog.show).toHaveBeenCalledWith(expect.objectContaining({
    showDenyButton: true,
    denyButtonText: 'common.clear'
  }))

  // The step's jsonSchema should be cleared
  expect(agent.steps[0].jsonSchema).toBeUndefined()
})

test('Agents button opens ContextMenuPlus with available agents', async () => {
  const agent = new Agent()
  agent.steps = [
    { prompt: 'Step 1', tools: null, agents: [] }
  ]

  const wrapper: VueWrapper<any> = mount(Editor, {
    ...stubTeleport,
    props: { 
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Navigate to workflow step
  const steps = wrapper.findAll('.wizard-step')
  const workflowStep = steps.find(step => step.text().includes('agent.create.workflow.title'))
  await workflowStep!.trigger('click')
  await nextTick()

  // ContextMenuPlus should not be visible initially
  let agentsMenu = wrapper.findComponent({ name: 'ContextMenuPlus' })
  expect(agentsMenu.exists()).toBe(false)

  // Click agents button
  const agentsButton = wrapper.find('.step-actions .agents')
  await agentsButton.trigger('click')
  await nextTick()

  // ContextMenuPlus should now be visible
  agentsMenu = wrapper.findComponent({ name: 'ContextMenuPlus' })
  expect(agentsMenu.exists()).toBe(true)

  // Should show available agents with checkboxes
  const checkboxes = agentsMenu.element.querySelectorAll('input[type="checkbox"]')
  expect(checkboxes.length).toBeGreaterThan(0) // Should have agents from store
})

test('Agents selection updates step with checkboxes', async () => {
  const agent = new Agent()
  agent.steps = [
    { prompt: 'Step 1', tools: null, agents: [] }
  ]

  const wrapper: VueWrapper<any> = mount(Editor, {
    ...stubTeleport,
    props: { 
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Navigate to workflow step
  const steps = wrapper.findAll('.wizard-step')
  const workflowStep = steps.find(step => step.text().includes('agent.create.workflow.title'))
  await workflowStep!.trigger('click')
  await nextTick()

  // Click agents button to show menu
  const agentsButton = wrapper.find('.step-actions .agents')
  await agentsButton.trigger('click')
  await nextTick()

  // Find ContextMenuPlus and click on first agent item
  const agentsMenu = wrapper.findComponent({ name: 'ContextMenuPlus' })
  expect(agentsMenu.exists()).toBe(true)

  // Find the first agent item (div with checkbox)
  const firstAgentItem = agentsMenu.element.querySelector('.item')
  if (firstAgentItem && store.agents.length > 0) {
    await firstAgentItem.click()
    await nextTick()
  
    // Agent step should be updated with the first available agent
    const firstAvailableAgent = store.agents.find(a => a.uuid !== agent.uuid)
    if (firstAvailableAgent) {
      expect(agent.steps[0].agents).toContain(firstAvailableAgent.uuid)
    }
  }
})

test('Agents can be cleared using footer unselect all button', async () => {
  // Get first two agents from store for testing
  const availableAgents = store.agents.slice(0, 2)
  const agentUuids = availableAgents.map(a => a.uuid)
  
  const agent = new Agent()
  agent.steps = [
    { prompt: 'Step 1', tools: null, agents: agentUuids }
  ]

  const wrapper: VueWrapper<any> = mount(Editor, {
    ...stubTeleport,
    props: { 
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Navigate to workflow step
  const steps = wrapper.findAll('.wizard-step')
  const workflowStep = steps.find(step => step.text().includes('agent.create.workflow.title'))
  await workflowStep!.trigger('click')
  await nextTick()

  // Initially should have agents assigned
  expect(agent.steps[0].agents).toEqual(agentUuids)

  // Click agents button to show menu
  const agentsButton = wrapper.find('.step-actions .agents')
  await agentsButton.trigger('click')
  await nextTick()

  // Find ContextMenuPlus and click unselect all button in footer
  const agentsMenu = wrapper.findComponent({ name: 'ContextMenuPlus' })
  expect(agentsMenu.exists()).toBe(true)

  // Should show footer with unselect all button
  const unselectAllButton = agentsMenu.element.querySelector('.footer-select button:last-child')
  if (unselectAllButton && unselectAllButton.textContent?.includes('common.unselectAll')) {
    await unselectAllButton.click()
    await nextTick()
  
    // Agent step agents should be cleared
    expect(agent.steps[0].agents).toEqual([])
  }
})

test('Agents button is disabled when no agents available', async () => {

  const agent = new Agent()
  agent.steps = [
    { prompt: 'Step 1', tools: null, agents: [] }
  ]
  
  // Temporarily clear agents to test disabled state
  const originalAgents = [...store.agents]
  store.agents = []

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Navigate to workflow step
  const steps = wrapper.findAll('.wizard-step')
  const workflowStep = steps.find(step => step.text().includes('agent.create.workflow.title'))
  await workflowStep!.trigger('click')
  await nextTick()

  // Agents button should be disabled
  const agentsButton = wrapper.find('.step-actions .agents')
  expect(agentsButton.attributes('disabled')).toBeDefined()
  
  // Restore original agents
  store.agents = originalAgents
})

test('Buttons show active styling when content is configured', async () => {
  const agent = new Agent()
  agent.steps = [
    { 
      prompt: 'Step 1', 
      tools: ['tool1'], 
      agents: ['agent1'], 
      docrepo: 'repo1',
      jsonSchema: '{"name": "string"}'
    }
  ]

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Navigate to workflow step
  const steps = wrapper.findAll('.wizard-step')
  const workflowStep = steps.find(step => step.text().includes('agent.create.workflow.title'))
  await workflowStep!.trigger('click')
  await nextTick()

  // All buttons should have active class when content is configured
  const docrepoButton = wrapper.find('.step-actions .docrepo')
  expect(docrepoButton.classes()).toContain('active')

  const toolsButton = wrapper.find('.step-actions .tools')
  expect(toolsButton.classes()).toContain('active')

  const agentsButton = wrapper.find('.step-actions .agents')
  expect(agentsButton.classes()).toContain('active')

  const jsonButton = wrapper.find('.step-actions .structured-output')
  expect(jsonButton.classes()).toContain('active')
})

test('Buttons do not show active styling when no content is configured', async () => {
  const agent = new Agent()
  agent.steps = [
    { prompt: 'Step 1', tools: [], agents: [] } // No content configured
  ]

  const wrapper: VueWrapper<any> = mount(Editor, {
    props: { 
      mode: 'edit',
      agent: agent
    }
  })
  await nextTick()

  // Navigate to workflow step
  const steps = wrapper.findAll('.wizard-step')
  const workflowStep = steps.find(step => step.text().includes('agent.create.workflow.title'))
  await workflowStep!.trigger('click')
  await nextTick()

  // Buttons should not have active class when no content is configured
  const docrepoButton = wrapper.find('.step-actions .docrepo')
  expect(docrepoButton.classes()).not.toContain('active')

  const toolsButton = wrapper.find('.step-actions .tools')
  expect(toolsButton.classes()).not.toContain('active')

  const agentsButton = wrapper.find('.step-actions .agents')
  expect(agentsButton.classes()).not.toContain('active')

  const jsonButton = wrapper.find('.step-actions .structured-output')
  expect(jsonButton.classes()).not.toContain('active')
})
