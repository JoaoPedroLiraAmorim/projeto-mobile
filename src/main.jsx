import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where
} from "firebase/firestore";
import {
  db,
  ensureAnonymousAuth,
  isFirebaseConfigured,
  firebaseConfig,
  usuariosService,
  notebooksService,
  reservasService,
  usoNotebooksService
} from "./firebase";
import { encryptPhone, decryptPhone } from "./crypto";
import "./styles.css";

function App() {
  const [activeTab, setActiveTab] = useState("contatos");
  const [uid, setUid] = useState("");
  const [status, setStatus] = useState("Conectando...");
  const [online, setOnline] = useState(navigator.onLine);

  // ---- Estado Contatos (Funcionalidade Original Mantida) ----
  const [contacts, setContacts] = useState([]);
  const [cName, setCName] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cEditing, setCEditing] = useState(null);
  const [cSaving, setCSaving] = useState(false);

  // ---- Estado Notebooks ----
  const [notebooks, setNotebooks] = useState([]);
  const [nbPatrimonio, setNbPatrimonio] = useState("");
  const [nbMarca, setNbMarca] = useState("");
  const [nbModelo, setNbModelo] = useState("");
  const [nbObs, setNbObs] = useState("");
  const [nbSaving, setNbSaving] = useState(false);

  // ---- Estado Reservas ----
  const [reservas, setReservas] = useState([]);
  const [resNbId, setResNbId] = useState("");
  const [resInicio, setResInicio] = useState("");
  const [resFim, setResFim] = useState("");
  const [resFinalidade, setResFinalidade] = useState("");
  const [resSaving, setResSaving] = useState(false);

  // ---- Estado Rastreamento de Uso ----
  const [usos, setUsos] = useState([]);
  const [usoNbId, setUsoNbId] = useState("");
  const [usoObsRetirada, setUsoObsRetirada] = useState("");
  const [usoSaving, setUsoSaving] = useState(false);

  // ---- Estado Usuários ----
  const [usuarios, setUsuarios] = useState([]);
  const [uNome, setUNome] = useState("");
  const [uEmail, setUEmail] = useState("");
  const [uCargo, setUCargo] = useState("aluno");
  const [uSaving, setUSaving] = useState(false);

  // Inicialização e Listeners
  useEffect(() => {
    const on = () => { setOnline(true); setStatus("Online • sincronizando..."); };
    const off = () => { setOnline(false); setStatus("Offline • dados locais"); };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);

    let unsubContacts, unsubNb, unsubRes, unsubUso, unsubUser;

    (async () => {
      try {
        const u = await ensureAnonymousAuth();
        setUid(u.uid);

        // 1. Ouvinte da coleção original 'contacts'
        const qContacts = query(collection(db, "contacts"), where("ownerId", "==", u.uid));
        unsubContacts = onSnapshot(qContacts, async (snap) => {
          const r = await Promise.all(
            snap.docs.map(async (d) => {
              const x = d.data();
              let p = "Telefone indisponível";
              try {
                p = await decryptPhone(x.phoneEncrypted);
              } catch {}
              return {
                id: d.id,
                name: x.name,
                email: x.email,
                phone: p,
                pending: d.metadata.hasPendingWrites
              };
            })
          );
          r.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
          setContacts(r);
          setStatus(
            snap.metadata.fromCache
              ? "Offline/cache • dados locais"
              : snap.docs.some((d) => d.metadata.hasPendingWrites)
              ? "Online • aguardando sincronização"
              : "Online • sincronizado"
          );
        }, (e) => {
          console.error("Erro contatos:", e);
          setStatus("Erro no Firebase");
        });

        // 2. Ouvinte de 'notebooks'
        unsubNb = notebooksService.listarNotebooks(setNotebooks);

        // 3. Ouvinte de 'reservas'
        unsubRes = reservasService.listarReservas(setReservas);

        // 4. Ouvinte de 'uso_notebooks'
        unsubUso = usoNotebooksService.listarUso(setUsos);

        // 5. Ouvinte de 'usuarios'
        unsubUser = usuariosService.listarUsuarios(setUsuarios);

      } catch (e) {
        console.error(e);
        setStatus("Configure o Firebase e o login Anonymous");
      }
    })();

    return () => {
      unsubContacts?.();
      unsubNb?.();
      unsubRes?.();
      unsubUso?.();
      unsubUser?.();
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // --- Handlers Contatos (Preservados 100%) ---
  const clearContactForm = () => {
    setCName("");
    setCPhone("");
    setCEmail("");
    setCEditing(null);
  };

  async function saveContact(e) {
    e.preventDefault();
    if (!cName.trim() || !cPhone.trim() || !cEmail.trim()) {
      alert("Preencha todos os campos.");
      return;
    }
    if (!cEmail.includes("@")) {
      alert("Informe um e-mail válido.");
      return;
    }
    if (!uid) {
      alert("Configure o Firebase primeiro.");
      return;
    }
    setCSaving(true);
    try {
      const payload = {
        name: cName.trim(),
        email: cEmail.trim().toLowerCase(),
        phoneEncrypted: await encryptPhone(cPhone.trim()),
        ownerId: uid,
        updatedAt: serverTimestamp()
      };
      if (cEditing) {
        await updateDoc(doc(db, "contacts", cEditing), payload);
      } else {
        await addDoc(collection(db, "contacts"), {
          ...payload,
          createdAt: serverTimestamp()
        });
      }
      clearContactForm();
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar contato. Veja o console.");
    } finally {
      setCSaving(false);
    }
  }

  // --- Handlers Notebooks ---
  async function saveNotebook(e) {
    e.preventDefault();
    if (!nbPatrimonio.trim()) {
      alert("Informe o número ou código de patrimônio.");
      return;
    }
    setNbSaving(true);
    try {
      await notebooksService.cadastrarNotebook({
        patrimonio: nbPatrimonio,
        marca: nbMarca,
        modelo: nbModelo,
        observacoes: nbObs
      });
      setNbPatrimonio("");
      setNbMarca("");
      setNbModelo("");
      setNbObs("");
    } catch (e) {
      alert("Erro ao cadastrar notebook: " + e.message);
    } finally {
      setNbSaving(false);
    }
  }

  // --- Handlers Reservas ---
  async function saveReserva(e) {
    e.preventDefault();
    if (!resNbId || !resInicio || !resFim) {
      alert("Selecione o notebook e os horários de início e término.");
      return;
    }
    const selectedNb = notebooks.find((n) => n.id === resNbId);
    setResSaving(true);
    try {
      await reservasService.criarReserva({
        notebookId: resNbId,
        notebookPatrimonio: selectedNb?.patrimonio || "N/A",
        usuarioId: uid,
        usuarioNome: (usuarios.find((u) => u.id === uid)?.nome) || "Usuário Atual",
        dataInicio: resInicio,
        dataFim: resFim,
        finalidade: resFinalidade
      });
      setResNbId("");
      setResInicio("");
      setResFim("");
      setResFinalidade("");
      alert("Reserva confirmada com sucesso!");
    } catch (e) {
      alert(e.message);
    } finally {
      setResSaving(false);
    }
  }

  // --- Handlers Rastreamento de Uso ---
  async function saveRetirada(e) {
    e.preventDefault();
    if (!usoNbId) {
      alert("Selecione o notebook a ser retirado.");
      return;
    }
    const selectedNb = notebooks.find((n) => n.id === usoNbId);
    setUsoSaving(true);
    try {
      await usoNotebooksService.registrarRetirada({
        notebookId: usoNbId,
        notebookPatrimonio: selectedNb?.patrimonio || "N/A",
        usuarioId: uid,
        usuarioNome: (usuarios.find((u) => u.id === uid)?.nome) || "Usuário Atual",
        observacoesRetirada: usoObsRetirada
      });
      setUsoNbId("");
      setUsoObsRetirada("");
      alert("Retirada registrada com sucesso! Notebook marcado como 'Em Uso'.");
    } catch (e) {
      alert("Erro ao registrar retirada: " + e.message);
    } finally {
      setUsoSaving(false);
    }
  }

  async function handleDevolucao(uso) {
    const obs = prompt("Observações na devolução (opcional):", "Devolvido em perfeitas condições.");
    if (obs === null) return;
    try {
      await usoNotebooksService.registrarDevolucao(uso.id, uso.notebookId, obs);
      alert("Devolução registrada com sucesso! Notebook liberado.");
    } catch (e) {
      alert("Erro ao registrar devolução: " + e.message);
    }
  }

  // --- Handlers Usuários ---
  async function saveUsuario(e) {
    e.preventDefault();
    if (!uNome.trim() || !uEmail.trim()) {
      alert("Preencha nome e e-mail.");
      return;
    }
    setUSaving(true);
    try {
      await usuariosService.salvarUsuario(uid, {
        nome: uNome,
        email: uEmail,
        cargo: uCargo,
        status: "ativo"
      });
      setUNome("");
      setUEmail("");
      alert("Perfil de usuário salvo com sucesso no Firestore!");
    } catch (e) {
      alert("Erro ao salvar usuário: " + e.message);
    } finally {
      setUSaving(false);
    }
  }

  return (
    <main className="page">
      <div className="app">
        <header>
          <div>
            <h1>🔐 Agenda Segura & Gestão de Notebooks</h1>
            <p>Cloud Firestore • Offline • AES-256 • Reservas & Rastreamento</p>
          </div>
          <div className={"status " + (online ? "on" : "off")}>
            <i /> {status}
          </div>
        </header>

        {!isFirebaseConfigured() && (
          <div className="config-alert">
            ℹ️ <strong>Firebase em modo de demonstração:</strong> As credenciais estão com valores de exemplo.
            Para conectar ao seu projeto real, preencha o arquivo <code>.env</code> com as credenciais do Firebase Console.
          </div>
        )}

        {/* Abas de Navegação */}
        <nav className="tabs">
          <button
            type="button"
            className={"tab-btn " + (activeTab === "contatos" ? "active" : "")}
            onClick={() => setActiveTab("contatos")}
          >
            📒 Agenda de Contatos ({contacts.length})
          </button>
          <button
            type="button"
            className={"tab-btn " + (activeTab === "notebooks" ? "active" : "")}
            onClick={() => setActiveTab("notebooks")}
          >
            💻 Notebooks ({notebooks.length})
          </button>
          <button
            type="button"
            className={"tab-btn " + (activeTab === "reservas" ? "active" : "")}
            onClick={() => setActiveTab("reservas")}
          >
            📅 Reservas ({reservas.length})
          </button>
          <button
            type="button"
            className={"tab-btn " + (activeTab === "uso" ? "active" : "")}
            onClick={() => setActiveTab("uso")}
          >
            🔄 Rastreamento de Uso ({usos.length})
          </button>
          <button
            type="button"
            className={"tab-btn " + (activeTab === "usuarios" ? "active" : "")}
            onClick={() => setActiveTab("usuarios")}
          >
            👥 Usuários ({usuarios.length})
          </button>
        </nav>

        {/* ==================================================================== */}
        {/* ABA 1: AGENDA DE CONTATOS (Criptografia AES-256-GCM mantida)          */}
        {/* ==================================================================== */}
        {activeTab === "contatos" && (
          <>
            <section className="card">
              <h2>{cEditing ? "Editar contato" : "Novo contato"}</h2>
              <form onSubmit={saveContact}>
                <label>
                  Nome
                  <input
                    value={cName}
                    onChange={(e) => setCName(e.target.value)}
                    placeholder="João da Silva"
                  />
                </label>
                <label>
                  Telefone
                  <input
                    value={cPhone}
                    onChange={(e) => setCPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                  />
                </label>
                <label>
                  E-mail
                  <input
                    value={cEmail}
                    onChange={(e) => setCEmail(e.target.value)}
                    placeholder="joao@email.com"
                  />
                </label>
                <div className="buttons">
                  <button className="primary" disabled={cSaving}>
                    {cSaving ? "Salvando..." : cEditing ? "Atualizar" : "Adicionar contato"}
                  </button>
                  {cEditing && (
                    <button type="button" onClick={clearContactForm}>
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
              <small>🔒 O telefone é criptografado com AES-256 no navegador antes do Firestore.</small>
            </section>

            <h2 className="listTitle">
              Contatos Cadastrados <b>{contacts.length}</b>
            </h2>
            {!contacts.length ? (
              <div className="empty">
                📒<strong>Nenhum contato cadastrado</strong>
                <p>Adicione seu primeiro contato acima.</p>
              </div>
            ) : (
              <div className="list">
                {contacts.map((c) => (
                  <article className="contact" key={c.id}>
                    <div className="avatar">{c.name[0]?.toUpperCase()}</div>
                    <div className="data">
                      <h3>{c.name}</h3>
                      <p>📞 {c.phone}</p>
                      <p>✉️ {c.email}</p>
                      {c.pending && <small>⏳ Aguardando sincronização...</small>}
                    </div>
                    <div className="actions">
                      <button
                        onClick={() => {
                          setCEditing(c.id);
                          setCName(c.name);
                          setCPhone(c.phone);
                          setCEmail(c.email);
                        }}
                      >
                        Editar
                      </button>
                      <button className="danger" onClick={() => deleteDoc(doc(db, "contacts", c.id))}>
                        Excluir
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}

        {/* ==================================================================== */}
        {/* ABA 2: NOTEBOOKS                                                    */}
        {/* ==================================================================== */}
        {activeTab === "notebooks" && (
          <>
            <section className="card">
              <h2>💻 Cadastrar Notebook</h2>
              <form onSubmit={saveNotebook}>
                <div className="grid-2">
                  <label>
                    Patrimônio / Código
                    <input
                      value={nbPatrimonio}
                      onChange={(e) => setNbPatrimonio(e.target.value)}
                      placeholder="Ex: NOTE-01"
                      required
                    />
                  </label>
                  <label>
                    Marca
                    <input
                      value={nbMarca}
                      onChange={(e) => setNbMarca(e.target.value)}
                      placeholder="Ex: Dell, Lenovo"
                    />
                  </label>
                </div>
                <div className="grid-2">
                  <label>
                    Modelo
                    <input
                      value={nbModelo}
                      onChange={(e) => setNbModelo(e.target.value)}
                      placeholder="Ex: Latitude 3420"
                    />
                  </label>
                  <label>
                    Observações
                    <input
                      value={nbObs}
                      onChange={(e) => setNbObs(e.target.value)}
                      placeholder="Ex: Acompanha carregador e mouse"
                    />
                  </label>
                </div>
                <div className="buttons">
                  <button className="primary" disabled={nbSaving}>
                    {nbSaving ? "Cadastrando..." : "Cadastrar Notebook"}
                  </button>
                </div>
              </form>
            </section>

            <h2 className="listTitle">
              Notebooks no Acervo <b>{notebooks.length}</b>
            </h2>
            {!notebooks.length ? (
              <div className="empty">
                💻<strong>Nenhum notebook cadastrado</strong>
                <p>Cadastre os notebooks da instituição acima.</p>
              </div>
            ) : (
              <div className="list">
                {notebooks.map((nb) => (
                  <article className="contact" key={nb.id}>
                    <div className="avatar">💻</div>
                    <div className="data">
                      <h3>
                        {nb.patrimonio}{" "}
                        <span className={"badge badge-" + (nb.status || "disponivel")}>
                          {nb.status || "disponivel"}
                        </span>
                      </h3>
                      <p>🏷️ {nb.marca} {nb.modelo}</p>
                      {nb.observacoes && <p>📝 {nb.observacoes}</p>}
                    </div>
                    <div className="actions">
                      {nb.status !== "manutencao" ? (
                        <button onClick={() => notebooksService.atualizarStatus(nb.id, "manutencao")}>
                          Marcar Manutenção
                        </button>
                      ) : (
                        <button onClick={() => notebooksService.atualizarStatus(nb.id, "disponivel")}>
                          Liberar Notebook
                        </button>
                      )}
                      <button className="danger" onClick={() => notebooksService.excluirNotebook(nb.id)}>
                        Excluir
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}

        {/* ==================================================================== */}
        {/* ABA 3: RESERVAS (Com detecção de conflito de horários)               */}
        {/* ==================================================================== */}
        {activeTab === "reservas" && (
          <>
            <section className="card">
              <h2>📅 Nova Reserva de Notebook</h2>
              <form onSubmit={saveReserva}>
                <label>
                  Selecione o Notebook
                  <select value={resNbId} onChange={(e) => setResNbId(e.target.value)} required>
                    <option value="">-- Escolha um notebook --</option>
                    {notebooks.map((nb) => (
                      <option key={nb.id} value={nb.id}>
                        {nb.patrimonio} - {nb.marca} {nb.modelo} ({nb.status})
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid-2">
                  <label>
                    Início da Reserva
                    <input
                      type="datetime-local"
                      value={resInicio}
                      onChange={(e) => setResInicio(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Término da Reserva
                    <input
                      type="datetime-local"
                      value={resFim}
                      onChange={(e) => setResFim(e.target.value)}
                      required
                    />
                  </label>
                </div>
                <label>
                  Finalidade / Motivo
                  <input
                    value={resFinalidade}
                    onChange={(e) => setResFinalidade(e.target.value)}
                    placeholder="Ex: Aula de Programação Web, Prova Prática"
                  />
                </label>
                <div className="buttons">
                  <button className="primary" disabled={resSaving}>
                    {resSaving ? "Validando e Reservando..." : "Confirmar Reserva"}
                  </button>
                </div>
              </form>
              <small>🛡️ O sistema valida automaticamente conflitos de horário com reservas existentes no Firestore.</small>
            </section>

            <h2 className="listTitle">
              Reservas Registradas <b>{reservas.length}</b>
            </h2>
            {!reservas.length ? (
              <div className="empty">
                📅<strong>Nenhuma reserva cadastrada</strong>
                <p>Agende uma reserva para um notebook acima.</p>
              </div>
            ) : (
              <div className="list">
                {reservas.map((r) => (
                  <article className="contact" key={r.id}>
                    <div className="avatar">📅</div>
                    <div className="data">
                      <h3>
                        {r.notebookPatrimonio}{" "}
                        <span className={"badge badge-" + r.status}>{r.status}</span>
                      </h3>
                      <p>👤 Solicitante: {r.usuarioNome}</p>
                      <p>⏰ Início: {new Date(r.dataInicio).toLocaleString("pt-BR")}</p>
                      <p>⏰ Término: {new Date(r.dataFim).toLocaleString("pt-BR")}</p>
                      {r.finalidade && <p>🎯 {r.finalidade}</p>}
                    </div>
                    <div className="actions">
                      {r.status === "confirmada" && (
                        <button className="danger" onClick={() => reservasService.cancelarReserva(r.id)}>
                          Cancelar Reserva
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}

        {/* ==================================================================== */}
        {/* ABA 4: RASTREAMENTO DE USO (Check-in e Check-out)                    */}
        {/* ==================================================================== */}
        {activeTab === "uso" && (
          <>
            <section className="card">
              <h2>🔄 Registrar Retirada de Notebook (Check-in)</h2>
              <form onSubmit={saveRetirada}>
                <label>
                  Selecione o Notebook Disponível
                  <select value={usoNbId} onChange={(e) => setUsoNbId(e.target.value)} required>
                    <option value="">-- Escolha um notebook disponível --</option>
                    {notebooks
                      .filter((nb) => nb.status === "disponivel")
                      .map((nb) => (
                        <option key={nb.id} value={nb.id}>
                          {nb.patrimonio} - {nb.marca} {nb.modelo}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Observações de Retirada
                  <input
                    value={usoObsRetirada}
                    onChange={(e) => setUsoObsRetirada(e.target.value)}
                    placeholder="Ex: Bateria em 100%, sem avarias"
                  />
                </label>
                <div className="buttons">
                  <button className="primary" disabled={usoSaving}>
                    {usoSaving ? "Registrando..." : "Registrar Retirada"}
                  </button>
                </div>
              </form>
              <small>📦 Ao retirar, o status do notebook muda automaticamente para 'Em Uso' no Firestore.</small>
            </section>

            <h2 className="listTitle">
              Histórico e Rastreamento de Uso <b>{usos.length}</b>
            </h2>
            {!usos.length ? (
              <div className="empty">
                🔄<strong>Nenhum uso registrado</strong>
                <p>Registre retiradas de notebooks para rastrear empréstimos.</p>
              </div>
            ) : (
              <div className="list">
                {usos.map((u) => (
                  <article className="contact" key={u.id}>
                    <div className="avatar">{u.status === "em_andamento" ? "⏳" : "✅"}</div>
                    <div className="data">
                      <h3>
                        {u.notebookPatrimonio}{" "}
                        <span className={"badge badge-" + u.status}>
                          {u.status === "em_andamento" ? "Em Uso" : "Devolvido"}
                        </span>
                      </h3>
                      <p>👤 Usuário: {u.usuarioNome}</p>
                      <p>📤 Retirada: {new Date(u.dataRetirada).toLocaleString("pt-BR")}</p>
                      {u.dataDevolucao && (
                        <p>📥 Devolução: {new Date(u.dataDevolucao).toLocaleString("pt-BR")}</p>
                      )}
                      {u.observacoesRetirada && <p>📝 Retirada: {u.observacoesRetirada}</p>}
                      {u.observacoesDevolucao && <p>📝 Devolução: {u.observacoesDevolucao}</p>}
                    </div>
                    <div className="actions">
                      {u.status === "em_andamento" && (
                        <button className="primary" onClick={() => handleDevolucao(u)}>
                          Registrar Devolução
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}

        {/* ==================================================================== */}
        {/* ABA 5: USUÁRIOS                                                     */}
        {/* ==================================================================== */}
        {activeTab === "usuarios" && (
          <>
            <section className="card">
              <h2>👥 Cadastro de Perfil de Usuário</h2>
              <form onSubmit={saveUsuario}>
                <div className="grid-2">
                  <label>
                    Nome Completo
                    <input
                      value={uNome}
                      onChange={(e) => setUNome(e.target.value)}
                      placeholder="Ex: Maria Oliveira"
                      required
                    />
                  </label>
                  <label>
                    E-mail Institucional
                    <input
                      value={uEmail}
                      onChange={(e) => setUEmail(e.target.value)}
                      placeholder="Ex: maria@escola.edu.br"
                      required
                    />
                  </label>
                </div>
                <label>
                  Cargo / Função
                  <select value={uCargo} onChange={(e) => setUCargo(e.target.value)}>
                    <option value="aluno">Aluno</option>
                    <option value="professor">Professor</option>
                    <option value="admin">Administrador / Suporte</option>
                  </select>
                </label>
                <div className="buttons">
                  <button className="primary" disabled={uSaving}>
                    {uSaving ? "Salvando..." : "Salvar Meu Perfil"}
                  </button>
                </div>
              </form>
              <small>🆔 UID atual autenticado: <code>{uid || "Conectando..."}</code></small>
            </section>

            <h2 className="listTitle">
              Usuários Registrados <b>{usuarios.length}</b>
            </h2>
            {!usuarios.length ? (
              <div className="empty">
                👥<strong>Nenhum usuário cadastrado</strong>
                <p>Cadastre seu perfil de usuário acima.</p>
              </div>
            ) : (
              <div className="list">
                {usuarios.map((usr) => (
                  <article className="contact" key={usr.id}>
                    <div className="avatar">👤</div>
                    <div className="data">
                      <h3>
                        {usr.nome}{" "}
                        <span className={"badge badge-" + usr.cargo}>{usr.cargo}</span>
                      </h3>
                      <p>✉️ {usr.email}</p>
                      <p>🔑 ID: {usr.id}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);