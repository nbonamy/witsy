
<template>
  <img :src="logo" class="logo" :class="[ engine, grayscale ? 'grayscale' : 'colored', background ? 'background' : '' ]" />
</template>

<script setup>

import { computed } from 'vue'
import logoOpenAI from '../../assets/openai.svg'
import logoOllama from '../../assets/ollama.svg'
import logoAnthropic from '../../assets/anthropic.svg'
import logoMistralAI from '../../assets/mistralai.svg'
import logoGoogle from '../../assets/google.svg'
import logoXAI from '../../assets/xai.svg'
import logoGroq from '../../assets/groq.svg'
import logoCerberas from '../../assets/cerebras.svg'

const logos = {
  openai: logoOpenAI,
  ollama: logoOllama,
  anthropic: logoAnthropic,
  mistralai: logoMistralAI,
  google: logoGoogle,
  xai: logoXAI,
  groq: logoGroq,
  cerebras: logoCerberas,
}

const props = defineProps({
  engine: String,
  grayscale: {
    type: Boolean,
    default: false
  },
  background: {
    type: Boolean,
    default: false
  }
})

const logo = computed(() => logos[props.engine])

</script>

<style scoped>

.logo.colored {
  object-fit: contain;
  border-radius: 6px;
  padding: 4px;
}

.logo.colored.openai {
  filter: invert(1);
}

.logo.background.openai {
  background-color: #865563;
}

.logo.colored.ollama {
  background-color: white;
}

.logo.grayscale.mistralai {
  filter: grayscale()
}

.logo.background.anthropic {
  background-color: #f0f0ea;
}

.logo.background.groq {
  background-color: #0aafc9;
  filter: invert(1) brightness(1.3);
}

.logo.grayscale.google {
  filter: grayscale();
}

.logo.background.xai {
  background-color: #f0f0ea;
}

.logo.grayscale.xai {
  filter: grayscale();
}

.logo.grayscale.cerebras {
  filter: grayscale()
}

.logo.background.cerebras {
  background-color: white;
  filter: none;
}

@media (prefers-color-scheme: dark) {
  .logo.openai {
    filter: invert(1) brightness(0.7);
  }
  .logo.ollama {
    filter: invert(1) brightness(0.7);
  }
  .logo.colored.ollama {
    filter: invert(0);
  }
  .logo.anthropic {
    filter: invert(1) brightness(0.7);
  }
  .logo.colored.anthropic {
    filter: invert(0)
  }
  .logo.groq {
    filter: invert(1) brightness(0.6);
  }
  .logo.grayscale.xai {
    filter: invert(1) brightness(0.7);
  }

  [data-tint=blue] {
    .logo.grayscale.openai {
      filter: invert(1) brightness(0.9);
    }
    .logo.grayscale.ollama {
      filter: invert(1) brightness(0.9);
    }
    .logo.grayscale.logo.anthropic {
      filter: invert(1) brightness(1.0);
    }
    .logo.logo.grayscale.mistralai {
      filter: grayscale() brightness(1.1);
    }
    .logo.grayscale.google {
      filter: grayscale() brightness(1.2);
    }
    .logo.grayscale.xai {
      filter: invert(1) brightness(0.9);
    }
    .logo.grayscale.groq {
      filter: invert(1) brightness(0.9);
    }
    .logo.grayscale.cerebras {
      filter: grayscale() brightness(1.85);
    }
  }
}

</style>
