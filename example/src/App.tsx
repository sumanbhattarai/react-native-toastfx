import { View, StyleSheet, Button } from 'react-native';
import Toast, { showSuccess } from 'react-native-toastfx';

export default function App() {
  const handlePress = () => {
    showSuccess({
      title: 'react-native-toastfx',
      message: 'This is an animated toast success message.',
    });
  };
  return (
    <View style={styles.container}>
      <Button title="Press Me" onPress={handlePress} />
      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
