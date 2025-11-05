// import React, { createContext, useContext, useEffect, useState } from 'react';
// import { createClient } from '@supabase/supabase-js';
// import { SupabaseClient } from '@supabase/supabase-js';

// const SupabaseContext = createContext<SupabaseClient | null>(null);

// export const SupabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
//     const [supabase] = useState(() => 
//         createClient('YOUR_SUPABASE_URL', 'YOUR_SUPABASE_ANON_KEY')
//     );

//     useEffect(() => {
//         // Handle authentication state changes
//         const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
//             console.log('Auth event:', event, session);
//         });

//         return () => {
//             authListener.subscription.unsubscribe();
//         };
//     }, [supabase]);

//     return (
//         <SupabaseContext.Provider value={supabase}>
//             {children}
//         </SupabaseContext.Provider>
//     );
// };

// export const useSupabase = () => {
//     const context = useContext(SupabaseContext);
//     if (!context) {
//         throw new Error('useSupabase must be used within a SupabaseProvider');
//     }
//     return context;
// };