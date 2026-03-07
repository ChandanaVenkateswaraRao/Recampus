import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function RideScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Ride Module</Text>
        <Text style={styles.text}>Web preview is running in fallback mode.</Text>
        <Text style={styles.text}>Open in Android or iOS (Expo Go/dev build) for full map features.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#f1f5f9',
  },
  card: {
    width: '100%',
    maxWidth: 520,
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#ffffff',
  },
  title: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  text: {
    color: '#475569',
    lineHeight: 20,
    marginBottom: 6,
  },
});
