# Agenda Segura & Gestão de Notebooks Web

Aplicação Web em React + Vite integrada com Cloud Firestore, cache offline, autenticação anônima e criptografia de ponta a ponta.

---

## 🚀 Como Executar

1. **Instalar dependências**:
   ```bash
   npm install
   ```

2. **Configurar variáveis de ambiente**:
   Copie o arquivo `.env.example` para `.env` e preencha com as credenciais do seu projeto no Firebase Console:
   ```env
   VITE_FIREBASE_API_KEY=sua_api_key_aqui
   VITE_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=seu-projeto
   VITE_FIREBASE_STORAGE_BUCKET=seu-projeto.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=seu_sender_id
   VITE_FIREBASE_APP_ID=seu_app_id
   ```

3. **Iniciar o servidor de desenvolvimento**:
   ```bash
   npm run dev
   ```
   Abra a URL indicada no terminal (geralmente `http://localhost:5173`).

---

## 🔧 Configuração no Firebase Console

1. **Criação do Projeto**:
   - Acesse [Firebase Console](https://console.firebase.google.com/) e crie um novo projeto.
2. **Registrar Aplicativo Web**:
   - Adicione um aplicativo Web (ícone `</>`), copie o objeto `firebaseConfig` gerado e cole no `.env`.
3. **Autenticação**:
   - Vá em **Build > Authentication > Sign-in method**.
   - Habilite o provedor **Anonymous** (Anônimo).
4. **Cloud Firestore**:
   - Vá em **Build > Firestore Database > Criar banco de dados**.
   - Escolha o modo de inicialização e a região geográfica.
   - Não é necessário criar tabelas/coleções previamente: o Firestore cria as coleções (`contacts`, `usuarios`, `notebooks`, `reservas`, `uso_notebooks`) automaticamente na primeira gravação.
5. **Regras de Segurança**:
   - Vá na aba **Regras** (Rules) do Firestore e publique o conteúdo do arquivo `firestore.rules`.

---

## 📦 Entidades e Recursos

- **`contacts`**: Agenda pessoal segura criptografada (AES-256-GCM no cliente).
- **`usuarios`**: Cadastro e perfil de usuários do sistema (alunos, professores, administradores).
- **`notebooks`**: Inventário de notebooks (patrimônio, especificações, status de disponibilidade).
- **`reservas`**: Agendamento de notebooks com validação automática de sobreposição e conflito de horários.
- **`uso_notebooks`**: Rastreamento de retiradas (check-in) e devoluções (check-out) com atualização em tempo real do status do notebook.
- **Cache offline e sincronização em múltiplos navegadores**: Implementado via `persistentLocalCache` e `persistentMultipleTabManager` do Firebase Firestore.
