import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Keyboard,
  TouchableWithoutFeedback
} from 'react-native';
import { Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useAuth } from '@/context/AuthContext';

type AuthView = 'login' | 'register';
type FieldName = 'email' | 'password' | 'phone' | null;

type AuthInputProps = {
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  focused: boolean;
  onFocus: () => void;
  onBlur: () => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
};

const AuthInput = React.memo(function AuthInput({
  label,
  icon,
  placeholder,
  value,
  onChangeText,
  focused,
  onFocus,
  onBlur,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'none',
}: AuthInputProps) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={[styles.fieldLabel, focused && styles.fieldLabelFocused]}>
        {label}
      </Text>

      <View style={[styles.fieldContainer, focused && styles.fieldContainerFocused]}>
        <Feather
          name={icon}
          size={18}
          style={[styles.fieldIcon, focused && styles.fieldIconFocused]}
        />

        <TextInput
          style={styles.fieldInput}
          placeholder={placeholder}
          placeholderTextColor="#8aa0c4"
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onBlur={onBlur}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
        />
      </View>
    </View>
  );
});

export default function AuthScreen() {
  const { token, loading, login, register } = useAuth();

  const [view, setView] = useState<AuthView>('login');
  const [focusedField, setFocusedField] = useState<FieldName>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');

  const [busy, setBusy] = useState(false);

  const isRegister = view === 'register';

  if (!loading && token) {
    return <Redirect href="/(tabs)" />;
  }

  const submit = async () => {
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

    const emailRegex = /^[a-zA-Z0-9._%+-]+@klu\.ac\.in$/;

    if (!emailRegex.test(trimmedEmail)) {
      Alert.alert(
        'Invalid Email',
        'Please use your official KLU email address (@klu.ac.in)'
      );
      return;
    }

    if (isRegister && !/^\+?[0-9]{10,15}$/.test(trimmedPhone)) {
      Alert.alert(
        'Invalid Phone',
        'Please enter a valid phone number (10–15 digits)'
      );
      return;
    }

    try {
      setBusy(true);

      if (view === 'login') {
        await login(trimmedEmail, password);
      } else {
        await register({
          email: trimmedEmail,
          password,
          phone: trimmedPhone
        });
      }

    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Authentication failed';

      Alert.alert('Error', message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <LinearGradient
          colors={['#eef4ff', '#dbeafe', '#c7ddff']}
          style={styles.gradient}
        >

          <KeyboardAwareScrollView
            enableOnAndroid
            extraScrollHeight={120}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >

            <View style={styles.card}>

              <View style={styles.brandRow}>
                <View style={styles.logo}>
                  <Text style={styles.logoText}>RC</Text>
                </View>

                <Text style={styles.brandTitle}>ReCampus</Text>
              </View>

              <View style={styles.tabSwitch}>
                <Pressable
                  style={[styles.tab, view === 'login' && styles.tabActive]}
                  onPress={() => setView('login')}
                >
                  <Text style={[styles.tabText, view === 'login' && styles.tabTextActive]}>
                    Login
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.tab, view === 'register' && styles.tabActive]}
                  onPress={() => setView('register')}
                >
                  <Text style={[styles.tabText, view === 'register' && styles.tabTextActive]}>
                    Sign Up
                  </Text>
                </Pressable>
              </View>

              <Text style={styles.title}>
                {isRegister ? 'Create Account' : 'Welcome Back'}
              </Text>

              <Text style={styles.subtitle}>
                {isRegister
                  ? 'Join ReCampus using your official KLU email.'
                  : 'Sign in to your KLU community'}
              </Text>

              <AuthInput
                label="Email"
                icon="mail"
                placeholder="id@klu.ac.in"
                value={email}
                onChangeText={setEmail}
                focused={focusedField === 'email'}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                keyboardType="email-address"
              />

              {isRegister && (
                <AuthInput
                  label="Phone"
                  icon="phone"
                  placeholder="10-15 digits"
                  value={phone}
                  onChangeText={setPhone}
                  focused={focusedField === 'phone'}
                  onFocus={() => setFocusedField('phone')}
                  onBlur={() => setFocusedField(null)}
                  keyboardType="phone-pad"
                />
              )}

              <AuthInput
                label="Password"
                icon="lock"
                placeholder="Enter password"
                value={password}
                onChangeText={setPassword}
                focused={focusedField === 'password'}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                secureTextEntry
              />

              <Pressable
                style={[
                  styles.buttonPrimary,
                  busy && styles.buttonDisabled
                ]}
                onPress={submit}
                disabled={busy}
              >
                {busy
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.buttonText}>
                      {isRegister ? 'Create Account' : 'Sign In'}
                    </Text>}
              </Pressable>

              <Text style={styles.trustLine}>
                VERIFIED STUDENT PLATFORM
              </Text>

            </View>

          </KeyboardAwareScrollView>

        </LinearGradient>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({

container: {
flex: 1,
backgroundColor: '#eef4ff'
},

gradient: {
flex: 1
},

scrollContent: {
flexGrow: 1,
justifyContent: 'center',
padding: 20
},

card: {
backgroundColor: '#fff',
borderRadius: 20,
padding: 22,
shadowColor: '#000',
shadowOpacity: 0.1,
shadowRadius: 10,
elevation: 5
},

brandRow: {
flexDirection: 'row',
alignItems: 'center',
marginBottom: 12
},

logo: {
width: 42,
height: 42,
borderRadius: 12,
backgroundColor: '#eaf2ff',
alignItems: 'center',
justifyContent: 'center',
marginRight: 10
},

logoText: {
fontWeight: '800',
color: '#1d4ed8'
},

brandTitle: {
fontSize: 20,
fontWeight: '800',
color: '#1e3a8a'
},

tabSwitch: {
flexDirection: 'row',
backgroundColor: '#eef4ff',
borderRadius: 12,
marginVertical: 15
},

tab: {
flex: 1,
padding: 10,
alignItems: 'center'
},

tabActive: {
backgroundColor: '#fff',
borderRadius: 12
},

tabText: {
color: '#3b82f6',
fontWeight: '700'
},

tabTextActive: {
color: '#1d4ed8'
},

title: {
fontSize: 26,
fontWeight: '800',
marginTop: 8
},

subtitle: {
color: '#64748b',
marginBottom: 15
},

fieldBlock: {
marginBottom: 12
},

fieldLabel: {
fontSize: 12,
fontWeight: '700',
color: '#64748b'
},

fieldLabelFocused: {
color: '#2563eb'
},

fieldContainer: {
flexDirection: 'row',
alignItems: 'center',
borderWidth: 1,
borderColor: '#dbeafe',
borderRadius: 12,
paddingHorizontal: 12,
paddingVertical: 12,
backgroundColor: '#f8fbff'
},

fieldContainerFocused: {
borderColor: '#2563eb',
backgroundColor: '#fff'
},

fieldIcon: {
marginRight: 8,
color: '#64748b'
},

fieldIconFocused: {
color: '#2563eb'
},

fieldInput: {
flex: 1,
fontSize: 15,
color: '#0f172a'
},

buttonPrimary: {
marginTop: 14,
backgroundColor: '#1d4ed8',
padding: 14,
borderRadius: 12,
alignItems: 'center'
},

buttonDisabled: {
opacity: 0.6
},

buttonText: {
color: '#fff',
fontWeight: '700',
fontSize: 15
},

trustLine: {
marginTop: 14,
textAlign: 'center',
fontSize: 11,
color: '#64748b',
fontWeight: '700'
}

});