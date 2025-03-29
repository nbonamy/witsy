# Contributing to Witsy

Thank you for considering contributing to Witsy! Here are some guidelines to help you get started.

## Code Contributions

### Development Environment

- **Node.js version**: `20.18`
- **npm version**: `11.1.0`

Use [nvm](https://github.com/nvm-sh/nvm) to switch between Node.js versions.

### Guidelines

1. **Keep `package-lock.json`**: `electron` and `electron-forge` are picky things and the versions of the packages used are important.
2. **Linting**: Run `npm run lint` to check for and fix any linting issues.
3. **Testing**: Add/Update required tests. Coverage varies betwen 80% and 82% and I would like to keep it that way (or more!). Run `npm run test` to ensure all tests pass before submitting your changes.

## Translation Contributions

### Steps

1. **Generate Translation File**: Use the script `./tools/i18n_auto.ts` with the two-letter language code (e.g., "es") and the name of the language in English (e.g., "Spanish").
2. **Review Translation**: Copy the generated file to a `locales` subfolder of the  data folder. You need to create this folder in:
  - **Windows**: `%APPDATA%/Witsy`
  - **macOS**: `~/Library/Application\ Support/Witsy`
  - **Linux**: `~/.config/Witsy`
3. **Reload the App**: Reload the application to review the translation.
4. **Select your language**: You should see your language in Settings | General. If you do not see the proper flag and name for your language you can add it to `src/components/LangSelect.vue`
5. **Final Review**: Before committing you can run `./tools/i18n_check.ts` whcih should return no errors and finally `./tools/i18n_sort.ts` to clean your file!
6. **Create a Pull Request**: Once you are satisfied with the translation, create a pull request for review.

Thank you for your contributions!