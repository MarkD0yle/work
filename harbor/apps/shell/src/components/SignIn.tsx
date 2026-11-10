import { auth } from '../auth.ts'
import { startSession } from '../workspaces/controller.ts'

export function SignIn() {
  return (
    <main className="hs-signin">
      <div className="hs-signin__card">
        <h1>Harbor</h1>
        <p>Choose a mock user to sign in. No credentials are used in this build.</p>
        <ul>
          {auth.listUsers().map((user) => (
            <li key={user.id}>
              <button type="button" className="hs-signin__user" onClick={() => void startSession(auth.signIn(user.id))}>
                <strong>{user.role}</strong>
                <span>{user.displayName}</span>
              </button>
            </li>
          ))}
        </ul>
        <span className="hs-mock">MOCK</span>
      </div>
    </main>
  )
}
