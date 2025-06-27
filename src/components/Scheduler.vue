
<template>

  <div class="scheduler">

    <select name="interval" v-model="interval" @change="save">
      <option value="">{{ t('common.schedule.disabled') }}</option>
      <option value="m">{{ t('common.schedule.minutes') }}</option>
      <option value="h">{{ t('common.schedule.hourly') }}</option>
      <option value="d">{{ t('common.schedule.daily') }}</option>
      <option value="w">{{ t('common.schedule.weekly') }}</option>
      <option value="M">{{ t('common.schedule.monthly') }}</option>
    </select>

    <template v-if="interval === 'm'">
      <span>{{ t('common.schedule.every') }}</span>
      <input type="text" name="every" v-model="every" @change="save" />
      <span>{{ t('common.schedule.minutes') }}</span>
    </template>

    <template v-else-if="interval === 'h'">
      <span>{{ t('common.schedule.every') }}</span>
      <input type="text" name="every" v-model="every" @change="save" />
      <span>{{ t('common.schedule.hours_on_minute') }}</span>  
      <input type="text" name="on" v-model="on" @change="save" />
    </template>

    <template v-else-if="interval === 'd'">
      <span>{{ t('common.schedule.every') }}</span>
      <input type="text" name="every" v-model="every" @change="save" />
      <span>{{ t('common.schedule.days_at') }}</span>
      <input type="text" class="time" name="at" v-model="at" placeholder="HH:MM" @change="save" />
    </template>

    <table v-else-if="interval === 'w'"><tbody>
      <tr>
        <td>{{ t('common.schedule.every') }}</td>
        <td>
          <input type="checkbox" name="mon" :checked="on.includes('1')" @change="onDay(1)" /><label class="no-colon">{{ t('common.schedule.monday') }}</label>
          <input type="checkbox" name="tue" :checked="on.includes('2')" @change="onDay(2)" /><label class="no-colon">{{ t('common.schedule.tuesday') }}</label>
          <input type="checkbox" name="wed" :checked="on.includes('3')" @change="onDay(3)" /><label class="no-colon">{{ t('common.schedule.wednesday') }}</label>
          <input type="checkbox" name="thu" :checked="on.includes('4')" @change="onDay(4)" /><label class="no-colon">{{ t('common.schedule.thursday') }}</label>
        </td>
      </tr>
      <tr>
        <td>&nbsp;</td>
        <td>
          <input type="checkbox" name="fri" :checked="on.includes('5')" @change="onDay(5)" /><label class="no-colon">{{ t('common.schedule.friday') }}</label>
          <input type="checkbox" name="sat" :checked="on.includes('6')" @change="onDay(6)" /><label class="no-colon">{{ t('common.schedule.saturday') }}</label>
          <input type="checkbox" name="sun" :checked="on.includes('0')" @change="onDay(0)" /><label class="no-colon">{{ t('common.schedule.sunday') }}</label>
        </td>
      </tr>
      <tr>
        <td>{{ t('common.schedule.at') }}</td>
        <td><input type="text" class="time" name="at" v-model="at" placeholder="HH:MM" @change="save" /></td>
      </tr>
    </tbody></table>

    <table v-else-if="interval === 'M'"><tbody>
      <tr>
        <td><span>{{ t('common.schedule.on_the') }}</span></td>
        <td>
          <input type="text" name="on" v-model="on" @change="save" />
          <span>{{ t('common.schedule.day_of_every') }}</span>
          <input type="text" name="every" v-model="every" @change="save" />
          <span>{{ t('common.schedule.months') }}</span>
        </td>
      </tr>
      <tr>
        <td><span>{{ t('common.schedule.at') }}</span></td>
        <td><input type="text" class="time" name="at" v-model="at" placeholder="HH:MM" @change="save" /></td>
      </tr>
    </tbody></table>

  </div>

</template>

<script setup lang="ts">

import { ref, onMounted, watch } from 'vue'
import { t } from '../services/i18n'

const schedule = defineModel({
  type: String,
  default: '',
})

const interval = ref('')
const on = ref('')
const every = ref('')
const at = ref('')

const emit = defineEmits(['change'])

onMounted(() => {
  watch(() => schedule.value || {}, update, { immediate: true })
})

const update = () => {
  
  // clear
  interval.value = ''
  on.value = ''
  every.value = ''
  at.value = ''

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

  const time = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`

  if (weeks != '*') {
    interval.value = 'w'
    on.value = weeks
    every.value = ''
    at.value = time
    return
  }

  if (months != '*') {
    interval.value = 'M'
    on.value = days
    every.value = months.split('/')[1] ?? '1'
    at.value = time
    return
  }

  if (days != '*') {
    interval.value = 'd'
    on.value = ''
    every.value = days.split('/')[1] ?? '1'
    at.value = time
    return
  }

  if (hours != '*') {
    interval.value = 'h'
    on.value = minutes
    every.value = hours.split('/')[1] ?? '1'
    at.value = ''
    return
  }

  if (minutes != '*') {
    interval.value = 'm'
    on.value = ''
    every.value = minutes.split('/')[1] ?? '1'
    at.value = ''
    return
  }

}

const onDay = (day: number) => {
  const days = on.value == '.' ? [] : on.value.split(',')
  const index = days.indexOf(day.toString())
  if (index !== -1) {
    days.splice(index, 1)
  } else {
    days.push(day.toString())
    days.sort((a, b) => parseInt(a) - parseInt(b))
  }
  on.value = days.join(',')
  save()
}

const save = () => {

  // clear
  schedule.value = ''
  if (!interval.value) {
    emit('change', schedule.value)
    return
  }

  // get time
  let hours = 0
  let minutes = 0
  if (at.value.includes(':')) {
    const [h, m] = at.value.split(':')
    hours = parseInt(h)
    minutes = parseInt(m)
  }

  // default
  if (every.value == '') {
    every.value = '1'
  }
  if (on.value == '') {
    on.value = interval.value === 'w' ? '.' : '0'
  }

  if (interval.value === 'w') {
    if (on.value === '') schedule.value = ''
    else schedule.value = `${minutes} ${hours} * * ${on.value}`
  }

  if (interval.value === 'M') {
    schedule.value = `${minutes} ${hours} ${on.value} */${every.value} *`
  }

  if (interval.value === 'd') {
    schedule.value = `${minutes} ${hours} */${every.value} * *`
  }

  if (interval.value === 'h') {
    schedule.value = `${on.value} */${every.value} * * *`
  }

  if (interval.value === 'm') {
    schedule.value = `*/${every.value} * * * *`
  }

  // done
  emit('change', schedule.value)

}

</script>

<style scoped>
@import '../../css/form.css';
</style>

<style scoped>

.scheduler {
  
  display: flex;
  flex-direction: row;
  align-items: baseline;
  gap: 12px;

  select {
    width: auto !important;
  }

  input {
    width: 32px !important;
    text-align: center;

    &.time {
      width: 64px !important;
    }
  }

  table {
    
    td {

      &:first-child {
        text-align: right;
        padding-right: 4px;
      }

      input[type=text] {
        margin: 0px 4px;
      }

      input[type=checkbox] {
        margin-top: 0px;
        margin-bottom: 0px;
        position: relative;
        top: -4px;
      }

      input[type=checkbox]:checked {
        margin-top: 0px;
        margin-bottom: 0px;
        position: relative;
        top: -5px;
      }
      
      input[type=checkbox]:checked:after {
        left: 0px !important;
      }
      
      label {
        margin-right: 4px;
        position: relative;
        top: -6px;
      }
    }
  }


}

</style>
