
<template>

  <div class="scheduler">

    <select name="interval" v-model="interval" @change="save" :disabled="disabled">
      <option v-if="intervals.includes('')" value="">{{ t('common.schedule.disabled') }}</option>
      <option v-if="intervals.includes('m')" value="m">{{ t('common.schedule.minutes') }}</option>
      <option v-if="intervals.includes('h')" value="h">{{ t('common.schedule.hourly') }}</option>
      <option v-if="intervals.includes('d')" value="d">{{ t('common.schedule.daily') }}</option>
      <option v-if="intervals.includes('w')" value="w">{{ t('common.schedule.weekly') }}</option>
      <option v-if="intervals.includes('M')" value="M">{{ t('common.schedule.monthly') }}</option>
    </select>

    <template v-if="interval === 'm'">
      <span>{{ t('common.schedule.every') }}</span>
      <input type="number" name="every" v-model.number="every" min="1" max="59" step="1" @input="save" />
      <span>{{ t('common.schedule.minutes') }}</span>
    </template>

    <template v-else-if="interval === 'h'">
      <span>{{ t('common.schedule.every') }}</span>
      <input type="number" name="every" v-model.number="every" min="1" max="23" step="1" @input="save" />
      <span>{{ t('common.schedule.hours_on_minute') }}</span>
      <input type="number" name="on" v-model.number="on" min="0" max="59" step="1" @input="save" />
    </template>

    <template v-else-if="interval === 'd'">
      <span>{{ t('common.schedule.every') }}</span>
      <input type="number" name="every" v-model.number="every" min="1" max="31" step="1" @input="save" />
      <span>{{ t('common.schedule.days_at') }}</span>
      <input type="time" class="time" name="at" v-model="at" @input="save" />
    </template>

    <div v-else-if="interval === 'w'" class="weekly">
      <div class="row">
        <span class="label">{{ t('common.schedule.every') }}</span>
        <div class="days-grid">
          <div class="day"><input type="checkbox" id="schedule-mon" name="mon" :checked="weekDays.includes(1)" @change="onDay(1)" /><label for="schedule-mon" class="no-colon">{{ t('common.schedule.monday') }}</label></div>
          <div class="day"><input type="checkbox" id="schedule-tue" name="tue" :checked="weekDays.includes(2)" @change="onDay(2)" /><label for="schedule-tue" class="no-colon">{{ t('common.schedule.tuesday') }}</label></div>
          <div class="day"><input type="checkbox" id="schedule-wed" name="wed" :checked="weekDays.includes(3)" @change="onDay(3)" /><label for="schedule-wed" class="no-colon">{{ t('common.schedule.wednesday') }}</label></div>
          <div class="day"><input type="checkbox" id="schedule-thu" name="thu" :checked="weekDays.includes(4)" @change="onDay(4)" /><label for="schedule-thu" class="no-colon">{{ t('common.schedule.thursday') }}</label></div>
          <div class="day"><input type="checkbox" id="schedule-fri" name="fri" :checked="weekDays.includes(5)" @change="onDay(5)" /><label for="schedule-fri" class="no-colon">{{ t('common.schedule.friday') }}</label></div>
          <div class="day"><input type="checkbox" id="schedule-sat" name="sat" :checked="weekDays.includes(6)" @change="onDay(6)" /><label for="schedule-sat" class="no-colon">{{ t('common.schedule.saturday') }}</label></div>
          <div class="day"><input type="checkbox" id="schedule-sun" name="sun" :checked="weekDays.includes(0)" @change="onDay(0)" /><label for="schedule-sun" class="no-colon">{{ t('common.schedule.sunday') }}</label></div>
        </div>
      </div>
      <div class="row">
        <span class="label">{{ t('common.schedule.at') }}</span>
        <input type="time" class="time" name="at" v-model="at" @input="save" />
      </div>
    </div>

    <table v-else-if="interval === 'M'"><tbody>
      <tr>
        <td><span>{{ t('common.schedule.on_the') }}</span></td>
        <td class="nowrap">
          <input type="number" name="on" v-model.number="on" min="1" max="31" step="1" @input="save" />
          <span style="margin: 0 4px;">{{ t('common.schedule.day_of_every') }}</span>
          <input type="number" name="every" v-model.number="every" min="1" max="12" step="1" @input="save" />
          <span style="margin-left: 4px;">{{ t('common.schedule.months') }}</span>
        </td>
      </tr>
      <tr>
        <td><span>{{ t('common.schedule.at') }}</span></td>
        <td><input type="time" class="time" name="at" v-model="at" @input="save" /></td>
      </tr>
    </tbody></table>

  </div>

</template>

<script setup lang="ts">

import { ref, computed, onMounted, watch } from 'vue'
import { t } from '@services/i18n'

const schedule = defineModel({
  type: String,
  default: '',
})

export type SchedulerInterval = '' | 'm' | 'h' | 'd' | 'w' | 'M'

const props = defineProps({
  disabled: {
    type: Boolean,
    default: false,
  },
  intervals: {
    type: Array as () => SchedulerInterval[],
    default: () => ['', 'm', 'h', 'd', 'w', 'M'],
  },
})

const interval = ref('')
const on = ref<number>(0)
const every = ref<number>(1)
const at = ref('')
const weekDays = ref<number[]>([])

const emit = defineEmits(['change'])

onMounted(() => {
  watch(() => schedule.value || {}, update, { immediate: true })
})

const update = () => {

  // clear
  interval.value = ''
  on.value = 0
  every.value = 1
  at.value = ''
  weekDays.value = []

  // if no schedule, return
  if (!schedule.value) {
    return
  }

  const parts = schedule.value.split(' ')
  const minutes = parts[0]
  const hours = parts[1]
  const days = parts[2]
  const months = parts[3]
  const weeks = parts[4]

  // Parse time safely
  const hoursNum = parseInt(hours) || 0
  const minutesNum = parseInt(minutes) || 0
  const time = `${hoursNum.toString().padStart(2, '0')}:${minutesNum.toString().padStart(2, '0')}`

  if (weeks != '*') {
    interval.value = 'w'
    weekDays.value = weeks.split(',').map(d => parseInt(d)).filter(d => !isNaN(d))
    every.value = 1
    at.value = time
    return
  }

  if (months != '*') {
    interval.value = 'M'
    on.value = parseInt(days) || 1
    every.value = parseInt(months.split('/')[1]) || 1
    at.value = time
    return
  }

  if (days != '*' && days != '*/1') {
    interval.value = 'd'
    on.value = 0
    every.value = parseInt(days.split('/')[1]) || 1
    at.value = time
    return
  }

  // Handle daily schedule (days = '*' or days = '*/1') but only if hours and minutes are NOT patterns
  if ((days == '*' || days == '*/1') && hours != '*' && minutes != '*' && !hours.includes('/') && !minutes.includes('/')) {
    interval.value = 'd'
    on.value = 0
    every.value = 1
    at.value = time
    return
  }

  if (hours != '*') {
    interval.value = 'h'
    on.value = parseInt(minutes) || 0
    every.value = parseInt(hours.split('/')[1]) || 1
    at.value = ''
    return
  }

  if (minutes != '*') {
    interval.value = 'm'
    on.value = 0
    every.value = parseInt(minutes.split('/')[1]) || 1
    at.value = ''
    return
  }

}

const onDay = (day: number) => {
  const index = weekDays.value.indexOf(day)
  if (index !== -1) {
    weekDays.value.splice(index, 1)
  } else {
    weekDays.value.push(day)
    weekDays.value.sort((a, b) => a - b)
  }
  save()
}

const save = () => {

  // clear
  schedule.value = ''
  if (!interval.value) {
    emit('change', schedule.value)
    return
  }

  // Parse time safely - at.value is in "HH:MM" format from time input
  let hours = 0
  let minutes = 0
  if (at.value && at.value.includes(':')) {
    const [h, m] = at.value.split(':')
    hours = parseInt(h) || 0
    minutes = parseInt(m) || 0
  }

  // Ensure valid defaults
  const safeEvery = every.value && every.value >= 1 ? every.value : 1
  const safeOn = on.value && on.value >= 0 ? on.value : 0

  if (interval.value === 'w') {
    const daysStr = weekDays.value.length > 0 ? weekDays.value.join(',') : '.'
    schedule.value = `${minutes} ${hours} * * ${daysStr}`
  }

  if (interval.value === 'M') {
    const dayOfMonth = safeOn >= 1 ? safeOn : 1
    schedule.value = `${minutes} ${hours} ${dayOfMonth} */${safeEvery} *`
  }

  if (interval.value === 'd') {
    schedule.value = `${minutes} ${hours} */${safeEvery} * *`
  }

  if (interval.value === 'h') {
    schedule.value = `${safeOn} */${safeEvery} * * *`
  }

  if (interval.value === 'm') {
    schedule.value = `*/${safeEvery} * * * *`
  }

  // done
  emit('change', schedule.value)

}

</script>


<style scoped>

.scheduler {

  display: flex;
  flex-direction: row;
  align-items: baseline;
  gap: 12px;

  select {
    width: auto !important;
  }

  input[type=number] {
    max-width: 56px !important;
    text-align: center;
    -moz-appearance: textfield;

    &::-webkit-outer-spin-button,
    &::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
  }

  input[type=time] {
    max-width: 128px !important;
    text-align: center;
  }

  .weekly {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .row {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 12px;

      .label {
        min-width: 40px;
        text-align: right;
      }
    }

    .days-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 4px 8px;

      .day {
        display: flex;
        align-items: center;
        white-space: nowrap;

        input[type=checkbox] {
          margin: 0;
        }

        label {
          margin-left: 4px;
        }
      }
    }
  }

  &:has(table) {
    align-items: flex-start;
  }

  table {

    td {

      &:first-child {
        text-align: right;
        padding-right: 4px;
      }

      &.nowrap {
        white-space: nowrap;
      }

      span {
        margin-top: 0px;
      }

      input[type=number],
      input[type=time] {
        margin: 0px 4px;
      }
    }
  }


}

</style>
